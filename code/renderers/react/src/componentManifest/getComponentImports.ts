import { dirname } from 'node:path';

import { type NodePath, babelParse, recast, types as t } from 'storybook/internal/babel';
import { type CsfFile } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import { getImportTag, getReactDocgen, matchPath } from './reactDocgen';
import { cachedResolveImport } from './utils';

// Public component metadata type used across passes
export type ComponentRef = {
  componentName: string;
  localImportName?: string;
  importId?: string;
  importOverride?: string;
  importName?: string;
  namespace?: string;
  path?: string;
  reactDocgen?: ReturnType<typeof getReactDocgen>;
};

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

/**
 * Collects all React component references used by a CSF story file and resolves as much import and
 * docgen information as possible.
 *
 * Behavior:
 *
 * - Scans the AST for JSX opening elements and meta.component to discover component identifiers.
 * - Filters out components that are locally defined without an import (these are not public imports).
 * - Maps local identifiers back to their import source/specifier when available.
 * - Optionally resolves the absolute file path of each component import (using storyFilePath) and
 *   augments the result with react-docgen info and an import override tag when present.
 *
 * Notes:
 *
 * - Member expressions like Foo.Bar are supported; namespace imports are represented accordingly.
 * - If react-docgen determines a package import override, it is stored in `importOverride`.
 *
 * @param csf The parsed CSF file instance whose AST will be inspected.
 * @param storyFilePath Optional absolute path of the story file to resolve relative imports
 *   against.
 * @returns An array of component references sorted by componentName.
 * @public
 */
export const getComponents = ({
  csf,
  storyFilePath,
}: {
  csf: CsfFile;
  storyFilePath?: string;
}): ComponentRef[] => {
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

  const body = program.get('body');

  // Collect import local bindings for component resolution (no package rewrite here)
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

    for (const s of specifiers) {
      if (!('local' in s) || !s.local) {
        continue;
      }

      if (isTypeSpecifier(s)) {
        continue;
      }

      const importId = decl.source.value;
      if (t.isImportDefaultSpecifier(s)) {
        localToImport.set(s.local.name, { importId, importName: 'default' });
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

  const componentObjs = filteredComponents
    .map((c) => {
      const dot = c.indexOf('.');
      if (dot !== -1) {
        const ns = c.slice(0, dot);
        const member = c.slice(dot + 1);
        const direct = localToImport.get(ns);
        return !direct
          ? { componentName: c }
          : direct.importName === '*'
            ? {
                componentName: c,
                localImportName: ns,
                importId: direct.importId,
                importName: member,
                namespace: ns,
              }
            : {
                componentName: c,
                localImportName: ns,
                importId: direct.importId,
                importName: direct.importName,
              };
      }
      const direct = localToImport.get(c);
      return direct
        ? {
            componentName: c,
            localImportName: c,
            importId: direct.importId,
            importName: direct.importName,
          }
        : { componentName: c };
    })
    .map((component) => {
      let path;
      try {
        if (component.importId && storyFilePath) {
          path = cachedResolveImport(matchPath(component.importId, dirname(storyFilePath)), {
            basedir: dirname(storyFilePath),
          });
        }
      } catch (e) {
        logger.error(e);
      }
      if (path) {
        const reactDocgen = getReactDocgen(path, component);
        return {
          ...component,
          path,
          reactDocgen,
          importOverride:
            reactDocgen.type === 'success' ? getImportTag(reactDocgen.data) : undefined,
        };
      }
      return component;
    })
    .sort((a, b) => a.componentName.localeCompare(b.componentName));

  return componentObjs;
};

/**
 * Builds a minimal, deduplicated list of import declarations required for the given components.
 *
 * Behavior:
 *
 * - Components are grouped by their (possibly rewritten) source package/path.
 * - If `packageName` is provided, relative imports are rewritten to that package name.
 * - If a component provides `importOverride`, its source and specifier are respected.
 * - Namespace imports are preserved unless a rewrite forces them to named members actually used.
 * - Default imports rewritten to a package become named imports using their local identifier.
 *
 * Output order:
 *
 * - Buckets preserve first-seen order of sources to keep declarations stable between runs.
 * - Within a bucket, namespace imports are emitted first (optionally coalesced with a default),
 *   followed by named-only, then any remaining defaults/namespaces one-per-declaration.
 *
 * @param components Component references to emit imports for. Only those with an importId are
 *   considered.
 * @param packageName Optional package name to rewrite relative imports to.
 * @returns An array of import declaration strings, formatted by recast.
 * @public
 */
export const getImports = ({
  components,
  packageName,
}: {
  components: ComponentRef[];
  packageName?: string;
}): string[] => {
  // Group by source (after potential rewrite)
  type Bucket = {
    source: t.StringLiteral;
    defaults: t.Identifier[];
    namespaces: t.Identifier[];
    named: t.ImportSpecifier[];
    order: number;
  };

  const isRelative = (id: string) => id.startsWith('.') || id === '.';

  const withSource = components
    .filter((c) => Boolean(c.importId))
    .map((c, idx) => {
      const importId = c.importId!;
      // If an importOverride is provided (and not a namespace import), override only the package/source
      const overrideSource = (() => {
        if (!c.importOverride) {
          return undefined;
        }
        try {
          const parsed = babelParse(c.importOverride);
          const decl = parsed.program.body.find((n) => t.isImportDeclaration(n)) as
            | t.ImportDeclaration
            | undefined;
          const src = decl?.source?.value;
          return typeof src === 'string' ? src : undefined;
        } catch {
          return undefined;
        }
      })();
      const rewritten =
        overrideSource !== undefined
          ? overrideSource
          : packageName && isRelative(importId)
            ? packageName
            : importId;
      return { c, src: t.stringLiteral(rewritten), key: rewritten, ord: idx };
    });

  const orderOfSource: Record<string, number> = {};
  for (const w of withSource) {
    if (orderOfSource[w.key] === undefined) {
      orderOfSource[w.key] = w.ord;
    }
  }

  const buckets = new Map<string, Bucket>();

  const ensureBucket = (key: string, src: t.StringLiteral): Bucket => {
    const prev = buckets.get(key);

    if (prev) {
      return prev;
    }
    const b: Bucket = {
      source: src,
      defaults: [],
      namespaces: [],
      named: [],
      order: orderOfSource[key] ?? 0,
    };
    buckets.set(key, b);
    return b;
  };

  for (const { c, src, key } of withSource) {
    const b = ensureBucket(key, src);

    // Determine if this bucket was rewritten
    const rewritten = src.value !== c.importId;

    // If an importOverride provides a concrete specifier (default, named, or namespace), respect it.
    // Do not try to match locals beyond using the bucketed structure. For namespace, just emit as-is.
    const overrideSpec = (() => {
      if (!c.importOverride) {
        return undefined;
      }
      try {
        const parsed = babelParse(c.importOverride);
        const decl = parsed.program.body.find((n) => t.isImportDeclaration(n)) as
          | t.ImportDeclaration
          | undefined;
        if (!decl) {
          return undefined;
        }
        const spec = (decl.specifiers ?? []).find((s) => !isTypeSpecifier(s as any));
        if (!spec) {
          return undefined;
        }
        if (t.isImportNamespaceSpecifier(spec)) {
          return { kind: 'namespace' as const, local: spec.local.name };
        }
        if (t.isImportDefaultSpecifier(spec)) {
          return { kind: 'default' as const };
        }
        if (t.isImportSpecifier(spec)) {
          const imported = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
          return { kind: 'named' as const, imported };
        }
        return undefined;
      } catch {
        return undefined;
      }
    })();

    if (overrideSpec) {
      if (overrideSpec.kind === 'namespace') {
        const ns = t.identifier(overrideSpec.local);
        addUniqueBy(b.namespaces, ns, (n) => n.name === ns.name);
        continue;
      }
      if (!c.localImportName) {
        continue;
      }
      if (overrideSpec.kind === 'default') {
        const id = t.identifier(c.localImportName);
        addUniqueBy(b.defaults, id, (d) => d.name === id.name);
        continue;
      }
      if (overrideSpec.kind === 'named') {
        const local = t.identifier(c.localImportName);
        const imported = t.identifier(overrideSpec.imported);
        addUniqueBy(
          b.named,
          t.importSpecifier(local, imported),
          (n) => n.local.name === local.name && importedName(n.imported) === imported.name
        );
        continue;
      }
    }

    if (c.namespace) {
      // Real namespace import usage (only present for `* as` imports)
      if (rewritten) {
        // Convert to named members actually used; require a concrete member name
        if (!c.importName) {
          continue;
        }
        const member = c.importName;
        const id = t.identifier(member);
        addUniqueBy(
          b.named,
          t.importSpecifier(id, id),
          (n) => n.local.name === member && importedName(n.imported) === member
        );
      } else {
        // Keep namespace import by base identifier once
        const ns = t.identifier(c.namespace);
        addUniqueBy(b.namespaces, ns, (n) => n.name === ns.name);
      }
      continue;
    }

    if (c.importName === 'default') {
      // localImportName is only emitted for imported components; add a defensive guard for TS
      if (!c.localImportName) {
        continue;
      }
      if (rewritten) {
        // default from relative becomes named using local identifier
        const id = t.identifier(c.localImportName);
        addUniqueBy(
          b.named,
          t.importSpecifier(id, id),
          (n) => n.local.name === id.name && importedName(n.imported) === id.name
        );
      } else {
        const id = t.identifier(c.localImportName);
        addUniqueBy(b.defaults, id, (d) => d.name === id.name);
      }
      continue;
    }

    if (c.importName) {
      // named import (including named used as namespace base)
      if (!c.localImportName) {
        continue;
      }
      const local = t.identifier(c.localImportName);
      const imported = t.identifier(c.importName);
      addUniqueBy(
        b.named,
        t.importSpecifier(local, imported),
        (n) => n.local.name === local.name && importedName(n.imported) === imported.name
      );
      continue;
    }
  }

  // Print merged declarations
  const merged: string[] = [];
  const printDecl = (
    specs: (t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier | t.ImportSpecifier)[],
    src: t.StringLiteral
  ) => {
    const node = t.importDeclaration(specs, src);
    const code = recast.print(node, {}).code;
    merged.push(code);
  };

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => a.order - b.order);
  for (const bucket of sortedBuckets) {
    const { source, defaults, namespaces, named } = bucket;

    if (defaults.length === 0 && namespaces.length === 0 && named.length === 0) {
      continue;
    }

    if (namespaces.length > 0) {
      const firstSpecs: (t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier)[] = [];

      if (defaults[0]) {
        firstSpecs.push(t.importDefaultSpecifier(defaults[0]));
      }
      firstSpecs.push(t.importNamespaceSpecifier(namespaces[0]));
      printDecl(firstSpecs, source);

      if (named.length > 0) {
        printDecl(named, source);
      }

      for (const d of defaults.slice(1)) {
        printDecl([t.importDefaultSpecifier(d)], source);
      }

      for (const ns of namespaces.slice(1)) {
        printDecl([t.importNamespaceSpecifier(ns)], source);
      }
    } else {
      if (defaults.length > 0 || named.length > 0) {
        const specs: (t.ImportDefaultSpecifier | t.ImportSpecifier)[] = [];

        if (defaults[0]) {
          specs.push(t.importDefaultSpecifier(defaults[0]));
        }
        specs.push(...named);
        printDecl(specs, source);
      }

      for (const d of defaults.slice(1)) {
        printDecl([t.importDefaultSpecifier(d)], source);
      }
    }
  }

  return merged;
};

/**
 * Convenience helper that combines `getComponents` and `getImports` in one call.
 *
 * It first discovers component references from the CSF file and then derives the minimal set of
 * import declarations for those components, applying the same rewrite/override rules as
 * `getImports`.
 *
 * @param csf The parsed CSF file instance.
 * @param packageName Optional package name used to rewrite relative imports.
 * @param storyFilePath Optional absolute path of the story file for resolving component import
 *   paths.
 * @returns An object containing the discovered components and the corresponding import statements.
 * @public
 */
export function getComponentData({
  csf,
  packageName,
  storyFilePath,
}: {
  csf: CsfFile;
  packageName?: string;
  storyFilePath?: string;
}): {
  components: ComponentRef[];
  imports: string[];
} {
  const components = getComponents({ csf, storyFilePath });
  const imports = getImports({ components, packageName });
  return { components, imports };
}
