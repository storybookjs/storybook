import { type NodePath, recast, types as t } from 'storybook/internal/babel';
import { type CsfFile } from 'storybook/internal/csf-tools';

// ---------- Helpers ----------
const baseIdentifier = (component: string) => component.split('.')[0] ?? component;

const isTypeSpecifier = (
  s: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier
) => t.isImportSpecifier(s) && s.importKind === 'type';

const importedName = (im: t.Identifier | t.StringLiteral) =>
  t.isIdentifier(im) ? im.name : im.value;

const addUniqueBy = <T>(arr: T[], item: T, eq: (a: T) => boolean) => {
  if (!arr.find(eq)) {
    arr.push(item);
  }
};

export function getComponentImports(
  csf: CsfFile,
  packageName?: string
): {
  components: { localName: string; importId?: string; importName?: string }[];
  imports: string[];
} {
  const program: NodePath<t.Program> = csf._file.path;

  const componentSet = new Set<string>();
  const localToImport = new Map<string, { importId: string; importName: string }>();

  // Gather components from all JSX opening elements
  program.traverse({
    JSXOpeningElement(p) {
      const n = p.node.name;
      if (t.isJSXIdentifier(n)) {
        const name = n.name;

        if (name && /[A-Z]/.test(name.charAt(0))) {
          componentSet.add(name);
        }
      } else if (t.isJSXMemberExpression(n)) {
        const jsxNameToString = (name: t.JSXIdentifier | t.JSXMemberExpression): string =>
          t.isJSXIdentifier(name)
            ? name.name
            : `${jsxNameToString(name.object)}.${jsxNameToString(name.property)}`;

        const full = jsxNameToString(n);
        // Left-most should be Identifier and typically capitalized; still record full path
        componentSet.add(full);
      }
    },
  });

  // Add meta.component if present
  const metaComp = csf._meta?.component;

  if (metaComp) {
    componentSet.add(metaComp);
  }

  const components = Array.from(componentSet).sort((a, b) => a.localeCompare(b));

  type Bucket = {
    source: t.StringLiteral;
    defaults: t.Identifier[];
    namespaces: t.Identifier[];
    named: t.ImportSpecifier[];
    order: number;
  };

  const buckets = new Map<string, Bucket>();
  let orderCounter = 0;

  const body = program.get('body');

  // First pass: collect all import local bindings for component resolution
  for (const stmt of body) {
    if (!stmt.isImportDeclaration()) {
      continue;
    }
    const decl = stmt.node;

    if (decl.importKind === 'type') {
      continue;
    }

    const specifiers = decl.specifiers ?? [];

    if (specifiers.length === 0) {
      continue;
    }

    const isRelToPkg = Boolean(packageName && decl.source.value.startsWith('.'));
    for (const s of specifiers) {
      if (!('local' in s) || !s.local) {
        continue;
      }

      if (isTypeSpecifier(s)) {
        continue;
      }

      const importId = decl.source.value;
      if (t.isImportDefaultSpecifier(s)) {
        const importName = isRelToPkg ? s.local.name : 'default';
        localToImport.set(s.local.name, { importId, importName });
      } else if (t.isImportNamespaceSpecifier(s)) {
        localToImport.set(s.local.name, { importId, importName: '*' });
      } else if (t.isImportSpecifier(s)) {
        const imported = importedName(s.imported);
        localToImport.set(s.local.name, { importId, importName: imported });
      }
    }
  }

  // Filter out locally defined components (those whose base identifier has a local, non-import binding)
  const isLocallyDefinedWithoutImport = (base: string): boolean => {
    const binding = program.scope.getBinding(base);

    if (!binding) {
      return false;
    } // missing binding -> keep (will become null import) // missing binding -> keep (will become null import)

    const isImportBinding = Boolean(
      binding.path.isImportSpecifier?.() ||
        binding.path.isImportDefaultSpecifier?.() ||
        binding.path.isImportNamespaceSpecifier?.()
    );
    return !isImportBinding;
  };

  const filteredComponents = components.filter(
    (c) => !isLocallyDefinedWithoutImport(baseIdentifier(c))
  );

  // Compute needed locals and namespace members after bindings are known
  const componentBasesArr = filteredComponents.map((c) => baseIdentifier(c));
  const effectiveNeededLocals = new Set(componentBasesArr.filter((b) => localToImport.has(b)));

  const namespaceMembers = new Map<string, Set<string>>();
  for (const c of filteredComponents) {
    const dot = c.indexOf('.');

    if (dot === -1) {
      continue;
    }

    const ns = c.slice(0, dot);
    const member = c.slice(dot + 1);

    if (!localToImport.has(ns)) {
      continue;
    }

    const set = namespaceMembers.get(ns) ?? new Set<string>();
    set.add(member);
    namespaceMembers.set(ns, set);
  }

  // Second pass: build buckets and filter by effective needed locals
  for (const stmt of body) {
    if (!stmt.isImportDeclaration()) {
      continue;
    }
    const decl = stmt.node;

    if (decl.importKind === 'type') {
      continue;
    } // skip type-only imports // skip type-only imports

    const specifiers = decl.specifiers ?? [];

    if (specifiers.length === 0) {
      continue;
    } // side-effect only import – ignore for component imports // side-effect only import – ignore for component imports

    const isRelToPkg = Boolean(packageName && decl.source.value.startsWith('.'));
    const nextSource = isRelToPkg ? t.stringLiteral(packageName!) : decl.source;
    const key = nextSource.value;
    const prev = buckets.get(key);
    const bucket =
      prev ??
      (() => {
        const b: Bucket = {
          source: nextSource,
          defaults: [],
          namespaces: [],
          named: [],
          order: orderCounter++,
        };
        buckets.set(key, b);
        return b;
      })();

    // Filter specifiers to only those whose local is referenced by components and not per-specifier type
    for (const s of specifiers) {
      if (!s.local || !effectiveNeededLocals.has(s.local.name)) {
        continue;
      }

      if (isTypeSpecifier(s)) {
        continue;
      }

      if (t.isImportDefaultSpecifier(s)) {
        if (isRelToPkg) {
          // Convert default to named when rewriting relative -> package
          const id = s.local;
          addUniqueBy(
            bucket.named,
            t.importSpecifier(id, id),
            (n) => n.local.name === id.name && importedName(n.imported) === id.name
          );
        } else {
          // de-duplicate by local name
          addUniqueBy(bucket.defaults, s.local, (d) => d.name === s.local!.name);
        }
        continue;
      }

      if (t.isImportNamespaceSpecifier(s)) {
        if (isRelToPkg) {
          // Convert namespace to named members that are actually used: UI.Button -> { Button }
          const members = namespaceMembers.get(s.local.name);
          if (members && members.size > 0) {
            for (const m of members) {
              const imp = t.identifier(m);
              addUniqueBy(
                bucket.named,
                t.importSpecifier(imp, imp),
                (n) => n.local.name === m && importedName(n.imported) === m
              );
            }
          }
        } else {
          addUniqueBy(bucket.namespaces, s.local, (n) => n.name === s.local!.name);
        }
        continue;
      }

      // ImportSpecifier: preserve imported vs local (handles aliasing)
      if (
        !bucket.named.find(
          (n) =>
            n.local.name === s.local!.name && importedName(n.imported) === importedName(s.imported)
        )
      ) {
        bucket.named.push(t.importSpecifier(s.local, s.imported));
      }
    }
  }

  // Now build merged import declarations per source in encounter order
  const mergedImports: string[] = [];
  for (const bucket of Array.from(buckets.values()).sort((a, b) => a.order - b.order)) {
    const { source, defaults, namespaces, named } = bucket;

    if (defaults.length === 0 && namespaces.length === 0 && named.length === 0) {
      continue;
    }

    const printDecl = (
      specs:
        | t.ImportSpecifier[]
        | (t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier | t.ImportSpecifier)[]
    ) => {
      const node = t.importDeclaration(specs, source);
      const code = recast.print(node, {}).code;
      mergedImports.push(code);
    };

    if (namespaces.length > 0) {
      // First statement: optional first default + first namespace
      const specs: (t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier)[] = [];

      if (defaults[0]) {
        specs.push(t.importDefaultSpecifier(defaults[0]));
      }
      specs.push(t.importNamespaceSpecifier(namespaces[0]));
      printDecl(specs);

      // Named specifiers cannot be combined with namespace; emit separately if present

      // Named specifiers cannot be combined with namespace; emit separately if present
      if (named.length > 0) {
        printDecl(named);
      }

      // Remaining defaults: each in its own statement

      // Remaining defaults: each in its own statement

      // Remaining defaults: each in its own statement
      for (const d of defaults.slice(1)) {
        printDecl([t.importDefaultSpecifier(d)]);
      }

      // Remaining namespaces: each in its own statement

      // Remaining namespaces: each in its own statement

      // Remaining namespaces: each in its own statement
      for (const ns of namespaces.slice(1)) {
        printDecl([t.importNamespaceSpecifier(ns)]);
      }
    } else {
      // No namespace: combine first default (if any) with all named specifiers
      if (defaults.length > 0 || named.length > 0) {
        const specs: (t.ImportDefaultSpecifier | t.ImportSpecifier)[] = [];

        if (defaults[0]) {
          specs.push(t.importDefaultSpecifier(defaults[0]));
        }
        specs.push(...named);
        printDecl(specs);
      }
      // Remaining defaults as standalone imports

      // Remaining defaults as standalone imports
      for (const d of defaults.slice(1)) {
        printDecl([t.importDefaultSpecifier(d)]);
      }
    }
  }

  const componentObjs = filteredComponents
    .map((c) => {
      const dot = c.indexOf('.');
      if (dot !== -1) {
        const ns = c.slice(0, dot);
        const member = c.slice(dot + 1);
        const direct = localToImport.get(ns);
        return {
          localName: c,
          importId: direct?.importId,
          importName: direct ? member : undefined,
        };
      }
      const direct = localToImport.get(c);
      return direct
        ? { localName: c, importId: direct.importId, importName: direct.importName }
        : { localName: c };
    })
    .sort((a, b) => a.localName.localeCompare(b.localName));

  return { components: componentObjs, imports: mergedImports };
}
