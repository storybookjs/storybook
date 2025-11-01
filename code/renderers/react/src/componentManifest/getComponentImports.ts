import { type NodePath, recast, types as t } from 'storybook/internal/babel';
import { type CsfFile } from 'storybook/internal/csf-tools';

const jsxNameToString = (name: t.JSXIdentifier | t.JSXMemberExpression): string =>
  t.isJSXIdentifier(name)
    ? name.name
    : `${jsxNameToString(name.object)}.${jsxNameToString(name.property)}`;

const baseIdentifier = (component: string) => component.split('.')[0] ?? component;

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
        // Only collect probable components (start with uppercase or namespace like UI)
        const name = n.name;
        if (name && /[A-Z]/.test(name[0])) {
          componentSet.add(name);
        }
      } else if (t.isJSXMemberExpression(n)) {
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

  const components = Array.from(componentSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  type Bucket = {
    source: t.StringLiteral;
    defaults: t.Identifier[];
    namespaces: t.Identifier[];
    named: t.ImportSpecifier[];
    order: number;
  };

  const buckets = new Map<string, Bucket>();
  let orderCounter = 0;

  const getBucket = (source: t.StringLiteral) => {
    const key = source.value;
    const existing = buckets.get(key);

    if (existing) {
      return existing;
    }
    const bucket: Bucket = {
      source,
      defaults: [],
      namespaces: [],
      named: [],
      order: orderCounter++,
    };
    buckets.set(key, bucket);
    return bucket;
  };

  const body = program.get('body');

  // First pass: collect all import local bindings for component resolution
  body.forEach((stmt) => {
    if (!stmt.isImportDeclaration()) {
      return;
    }
    const decl = stmt.node;

    if (decl.importKind === 'type') {
      return;
    }
    const specifiers = decl.specifiers ?? [];

    if (specifiers.length === 0) {
      return;
    }
    const isRelToPkg = Boolean(packageName && decl.source.value.startsWith('.'));
    specifiers.forEach((s) => {
      if (!s.local) {
        return;
      }

      if (t.isImportSpecifier(s) && s.importKind === 'type') {
        return;
      }
      const importId = decl.source.value;
      if (t.isImportDefaultSpecifier(s)) {
        const importName = isRelToPkg ? s.local.name : 'default';
        localToImport.set(s.local.name, { importId, importName });
      } else if (t.isImportNamespaceSpecifier(s)) {
        localToImport.set(s.local.name, { importId, importName: '*' });
      } else if (t.isImportSpecifier(s)) {
        const imported = (s.imported as t.Identifier).name;
        localToImport.set(s.local.name, { importId, importName: imported });
      }
    });
  });

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
    // Exclude if there is a local, non-import binding
    return !isImportBinding;
  };

  const filteredComponents = components.filter(
    (c) => !isLocallyDefinedWithoutImport(baseIdentifier(c))
  );

  // Compute needed locals and namespace members after bindings are known
  const componentBasesArr = filteredComponents.map((c) => baseIdentifier(c));
  const effectiveNeededLocals = new Set(componentBasesArr.filter((b) => localToImport.has(b)));

  const namespaceMembers = new Map<string, Set<string>>();
  filteredComponents.forEach((c) => {
    const dot = c.indexOf('.');

    if (dot === -1) {
      return;
    }
    const ns = c.slice(0, dot);
    const member = c.slice(dot + 1);

    if (!localToImport.has(ns)) {
      return;
    }
    const set = namespaceMembers.get(ns) ?? new Set<string>();
    set.add(member);
    namespaceMembers.set(ns, set);
  });

  // Second pass: build buckets and filter by effective needed locals
  body.forEach((stmt) => {
    if (!stmt.isImportDeclaration()) {
      return;
    }
    const decl = stmt.node;

    if (decl.importKind === 'type') {
      return;
    } // skip type-only imports

    const specifiers = decl.specifiers ?? [];
    if (specifiers.length === 0) {
      // side-effect only import – ignore for component imports
      return;
    }

    const isRelToPkg = Boolean(packageName && decl.source.value.startsWith('.'));
    const nextSource = isRelToPkg ? t.stringLiteral(packageName!) : decl.source;

    const bucket = getBucket(nextSource);

    // Filter specifiers to only those whose local is referenced by components and not per-specifier type
    specifiers.forEach((s) => {
      if (!s.local || !effectiveNeededLocals.has(s.local.name)) {
        return;
      }

      if (t.isImportSpecifier(s) && s.importKind === 'type') {
        return;
      }

      if (t.isImportDefaultSpecifier(s)) {
        if (isRelToPkg) {
          // Convert default to named when rewriting relative -> package
          const id = s.local;
          const exists = bucket.named.find(
            (n) => n.local.name === id.name && (n.imported as t.Identifier).name === id.name
          );
          if (!exists) {
            bucket.named.push(t.importSpecifier(id, id));
          }
        } else {
          // de-duplicate by local name
          if (!bucket.defaults.find((d) => d.name === s.local!.name)) {
            bucket.defaults.push(s.local);
          }
        }
        return;
      }
      if (t.isImportNamespaceSpecifier(s)) {
        if (isRelToPkg) {
          // Convert namespace to named members that are actually used: UI.Button -> { Button }
          const members = namespaceMembers.get(s.local.name);
          if (members && members.size > 0) {
            members.forEach((m) => {
              const imp = t.identifier(m);
              const exists = bucket.named.find(
                (n) => n.local.name === m && (n.imported as t.Identifier).name === m
              );
              if (!exists) {
                bucket.named.push(t.importSpecifier(imp, imp));
              }
            });
          }
        } else {
          if (!bucket.namespaces.find((n) => n.name === s.local!.name)) {
            bucket.namespaces.push(s.local);
          }
        }
        return;
      }
      // ImportSpecifier: preserve imported vs local (handles aliasing)
      if (
        !bucket.named.find(
          (n) =>
            n.local.name === s.local!.name &&
            (n.imported as t.Identifier).name === (s.imported as t.Identifier).name
        )
      ) {
        bucket.named.push(t.importSpecifier(s.local, s.imported));
      }
    });
  });

  // Now build merged import declarations per source in encounter order
  const mergedImports: string[] = [];
  Array.from(buckets.values())
    .sort((a, b) => a.order - b.order)
    .forEach((bucket) => {
      const { source, defaults, namespaces, named } = bucket;

      // Nothing collected — skip
      if (defaults.length === 0 && namespaces.length === 0 && named.length === 0) {
        return;
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
        if (named.length > 0) {
          printDecl(named);
        }

        // Remaining defaults: each in its own statement
        defaults.slice(1).forEach((d) => {
          printDecl([t.importDefaultSpecifier(d)]);
        });

        // Remaining namespaces: each in its own statement
        namespaces.slice(1).forEach((ns) => {
          printDecl([t.importNamespaceSpecifier(ns)]);
        });
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
        defaults.slice(1).forEach((d) => {
          printDecl([t.importDefaultSpecifier(d)]);
        });
      }
    });

  const componentObjs = filteredComponents
    .map((c) => {
      const dot = c.indexOf('.');
      if (dot !== -1) {
        const ns = c.slice(0, dot);
        const member = c.slice(dot + 1);
        const direct = localToImport.get(ns);
        return direct
          ? { localName: c, importId: direct.importId, importName: member }
          : { localName: c };
      }
      const direct = localToImport.get(c);
      return direct
        ? { localName: c, importId: direct.importId, importName: direct.importName }
        : { localName: c };
    })
    .sort((a, b) => (a.localName < b.localName ? -1 : a.localName > b.localName ? 1 : 0));

  return { components: componentObjs, imports: mergedImports };
}
