// The identification layer: resolve a name to what it ultimately is.
//
// Marker-free by construction: nothing here reads annotations in the product
// or the DS. A name's identity comes solely from where the module graph says it
// came from:
// * imports from a DS-pattern package are DS
// * re-exports and barrel files (including `export *` chains) are followed
//   recursively until a terminal binding is found
// * local declarations are handed to the framework's declaration analyzer
//   (which recurses back in here for any names it needs)
//
// Every entry point is memoized and cycle-guarded. A resolution that re-enters
// itself gets a `circular` placeholder rather than looping — and any result
// computed while such a placeholder was observed is NOT cached, because it is
// only valid for the cycle that produced it; caching it would serve the
// placeholder to non-cyclic callers forever.
import ts from 'typescript';

import type { ModuleFile, ModuleGraph } from './module-graph.ts';
import type { DeclarationAnalyzer, IdentityResolver, Resolution } from './types.ts';

function unresolved(reason: string): Resolution {
  return { category: 'unresolved', reason };
}

/**
 * The elements a `for…of` binding iterates, when they can be named statically.
 *
 * A `for…of` pattern binds an *element* of the iterated value, never the value
 * itself, and `Resolution` has no way to say "an element of". Only an array
 * literal spells its elements out, so it is the one iterable whose elements can
 * be resolved rather than guessed — reading `for (const { Item } of items)` as
 * `items.Item` would fabricate a name the package does not export. A spread
 * hides however many elements it expands to, and is opaque for the same reason.
 *
 * `null` means the declaration is not a `for…of` binding at all; `'opaque'`
 * means it is one whose elements cannot be enumerated.
 */
function iteratedElements(
  declaration: ts.VariableDeclaration
): readonly ts.Expression[] | 'opaque' | null {
  const list = declaration.parent;
  if (!ts.isVariableDeclarationList(list)) return null;
  const statement = list.parent;
  if (!ts.isForOfStatement(statement)) return null;
  const iterated = statement.expression;
  if (!ts.isArrayLiteralExpression(iterated)) return 'opaque';
  if (iterated.elements.some(ts.isSpreadElement)) return 'opaque';
  return iterated.elements;
}

/**
 * A comparable key for the identity a resolution names, or null when it names
 * none — a namespace, an object literal, or an unresolved value.
 */
function identityKey(resolution: Resolution): string | null {
  switch (resolution.category) {
    case 'host':
      return `host#${resolution.tag}`;
    case 'ds':
    case 'external':
    case 'local':
    case 'wrapped-ds':
      return `${resolution.category}#${resolution.module}#${resolution.name}`;
    case 'namespace':
    case 'object':
    case 'unresolved':
      return null;
  }
}

// The circular handling here is very hard to understand.
// Say we have an a ↔ b barrel cycle where some exports are provided
// by a secondary star export.
//
// src/features/a/index.ts    export { Button } from '../b'
// src/features/b/index.ts    export * from '../a'
//                            export * from './Button'
// src/features/b/Button.ts   export { Button } from '@ds/core'

// When another file calls `import { Button } from './features/b'`,
// there's a point in time where b thinks Button comes from a, but
// a circles back to b's own export of Button. The resolution of
// b#Button requires inspecting other star exports further down the
// line. At this moment, we detect that a cycle has occurred. As
// long as `placeholdersBefore` and `circularPlaceholders` disagree,
// we're still in the stack where that cycle occurred, so we can't
// rely on anything just yet. We need to walk back from the cycle
// and examine the next exports.
export function createResolver(
  graph: ModuleGraph,
  isDsPackage: (specifier: string) => boolean,
  analyzeDeclaration: DeclarationAnalyzer
): IdentityResolver {
  const cache = new Map<string, Resolution>();
  const inFlight = new Set<string>();
  const declarationCache = new Map<ts.Node, Resolution>();
  const declarationsInFlight = new Set<ts.Node>();
  // Bumped every time a circular placeholder is handed out; a computation
  // that observed one produced a cycle-relative answer, not a cacheable one.
  let circularPlaceholders = 0;

  function circularPlaceholder(reason: string): Resolution {
    circularPlaceholders += 1;
    return { category: 'unresolved', reason, circular: true };
  }

  /** Memoize + cycle-guard a resolution under `key`. */
  function guarded(key: string, resolve: () => Resolution): Resolution {
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    if (inFlight.has(key)) {
      return circularPlaceholder(`circular resolution at ${key}`);
    }
    inFlight.add(key);

    const placeholdersBefore = circularPlaceholders;
    try {
      const resolution = resolve();
      if (circularPlaceholders === placeholdersBefore) {
        cache.set(key, resolution);
      }
      return resolution;
    } finally {
      inFlight.delete(key);
    }
  }

  function packageIdentity(specifier: string, exportName: string): Resolution {
    return isDsPackage(specifier)
      ? { category: 'ds', module: specifier, name: exportName }
      : { category: 'external', module: specifier, name: exportName };
  }

  /**
   * Whether `path` (a graph file) provides `exportName`, looking through its
   * own `export *` chains. Star re-exports never provide `default` (ESM
   * semantics), and a file whose very export is mid-resolution is no provider
   * — reaching the name through it would only re-enter the cycle. Used to
   * pick which star re-export to follow in a barrel.
   */
  function providesExport(path: string, exportName: string, seen: Set<string>): boolean {
    // Edge cases and re-entries.
    if (exportName === 'default') return false;
    if (seen.has(path)) return false;
    if (inFlight.has(`export:${path}#${exportName}`)) return false;
    seen.add(path);

    // File not found, can't proceed.
    const file = graph.files.get(path);
    if (!file) {
      return false;
    }

    // Finally, answer the export question.
    if (file.exports.has(exportName)) {
      return true;
    }
    return file.starReexports.some((specifier) => {
      const target = graph.resolveSpecifier(path, specifier);
      return target.type === 'file' && providesExport(target.path, exportName, seen);
    });
  }

  /**
   * Every package reached by the star chain, in source order, deduplicated.
   * Recursive function, call with an empty seen set and empty found array.
   */
  function starPackages(file: ModuleFile, seen: Set<string>, found: string[]): string[] {
    // Re-entry guard.
    if (seen.has(file.path)) {
      return found;
    }
    seen.add(file.path);

    // Recursion.
    for (const specifier of file.starReexports) {
      const target = graph.resolveSpecifier(file.path, specifier);
      if (target.type === 'package' && !found.includes(target.specifier)) {
        found.push(target.specifier);
      }
      if (target.type === 'file') {
        const next = graph.files.get(target.path);
        if (next) {
          starPackages(next, seen, found);
        }
      }
    }
    return found;
  }

  /**
   * Called when none of the star exports resolve to files we can locally
   * analyse, but instead to external packages. As we can't verify from
   * these packages which ones have circular exports with ourselves, we can't
   * assert for sure where the export came from. We only report a decisive
   * answer if all packages with star exports resolve the same way (all DS
   * or all non-DS). Otherwise, we report the export as unresolved.
   */
  function starPackageFallback(file: ModuleFile, exportName: string): Resolution | null {
    const candidates = starPackages(file, new Set(), []);
    if (candidates.length === 0) {
      return null;
    }

    const first = candidates[0] as string;
    if (candidates.every((candidate) => isDsPackage(candidate) === isDsPackage(first))) {
      return packageIdentity(first, exportName);
    }

    return unresolved(
      `'${exportName}' is star re-exported from several packages (${candidates.join(', ')}) that disagree on DS membership`
    );
  }

  function resolveStarReexports(file: ModuleFile, exportName: string): Resolution | null {
    if (exportName === 'default') {
      return null;
    }

    let circularResult: Resolution | null = null;
    for (const specifier of file.starReexports) {
      const target = graph.resolveSpecifier(file.path, specifier);
      if (target.type !== 'file') {
        continue;
      }
      if (!providesExport(target.path, exportName, new Set([file.path]))) {
        continue;
      }

      const resolution = resolveExport(target.path, exportName);
      // We'll hope to get a better resolution from the next star re-export.
      // If none work out, we'll return that unresolved result to the callee.
      if (resolution.category === 'unresolved' && resolution.circular) {
        circularResult = resolution;
        continue;
      }

      // We found a good resolution, we can return it.
      return resolution;
    }

    // We could not find a locally analysable resolution from all our
    // star exports. Try a fallback method based on the identities of
    // the packages we star-export from. If that fails too, return
    // either `null` or the last circular resolution we found.
    return starPackageFallback(file, exportName) ?? circularResult;
  }

  // Resolve a module specifier to its ultimate identity.
  function resolveModule(file: ModuleFile, specifier: string, exportName: string): Resolution {
    const target = graph.resolveSpecifier(file.path, specifier);
    if (target.type === 'package') return packageIdentity(target.specifier, exportName);
    if (target.type === 'missing') return unresolved(`unresolvable import '${specifier}'`);
    return resolveExport(target.path, exportName);
  }

  function resolveExport(path: string, exportName: string): Resolution {
    return guarded(`export:${path}#${exportName}`, () => {
      const file = graph.files.get(path);
      if (!file) {
        return unresolved(`no module at ${path}`);
      }

      // If the export we're looking for is not found, either it comes from  a star
      // re-export, or the importing module is outdated and imports a missing export.
      const binding = file.exports.get(exportName);
      if (binding === undefined) {
        return (
          resolveStarReexports(file, exportName) ??
          unresolved(`${path} has no export '${exportName}'`)
        );
      }

      switch (binding.type) {
        case 'local':
          return resolveLocal(file, binding.name);
        case 'reexport':
          return resolveModule(file, binding.from, binding.name);
        case 'namespaceReexport': {
          const target = graph.resolveSpecifier(path, binding.from);
          if (target.type === 'package') {
            return {
              category: 'namespace',
              module: { kind: 'package', specifier: target.specifier },
            };
          }
          if (target.type === 'file') {
            return { category: 'namespace', module: { kind: 'file', path: target.path } };
          }
          return unresolved(`unresolvable import '${binding.from}'`);
        }
        case 'expression':
          return memoizedAnalyze(file, binding.node, exportName);
      }
    });
  }

  // Resolve a local variable name. Those can be imports (import Checkbox from '@base-ui/react'),
  // local variables (const Root = Checkbox.Root) or destructured bindings (const { Root } = Checkbox).
  // Any such local specifier can still be a DS import so we need to trace their origin.
  function resolveLocal(file: ModuleFile, name: string): Resolution {
    return guarded(`local:${file.path}//${name}`, () => {
      const binding = file.locals.get(name);
      if (binding === undefined) return unresolved(`unbound identifier '${name}' in ${file.path}`);

      switch (binding.type) {
        case 'import':
          return resolveModule(file, binding.from, binding.name);
        case 'namespaceImport': {
          const target = graph.resolveSpecifier(file.path, binding.from);
          if (target.type === 'package') {
            return {
              category: 'namespace',
              module: { kind: 'package', specifier: target.specifier },
            };
          }
          if (target.type === 'file') {
            return { category: 'namespace', module: { kind: 'file', path: target.path } };
          }
          return unresolved(`unresolvable import '${binding.from}'`);
        }
        case 'declaration':
        case 'destructured': {
          const resolution =
            binding.type === 'declaration'
              ? memoizedAnalyze(file, binding.node, name)
              : resolveDestructured(file, binding.node, binding.path, name);
          // The breadcrumb lets member access find `Name.Prop = …`
          // assignments in this module even when the declaration itself
          // resolved through a wrapper into a DS or host identity.
          if (resolution.category === 'namespace' || resolution.category === 'object') {
            return resolution;
          }
          return { ...resolution, declaredAt: { file, name } };
        }
      }
    });
  }

  // Resolve a destructured binding. The `path` is the chain of property names
  // that lead to the value being destructured. For example, in
  // `const { A: { B } } = X`, the path for `B` is `['A']`.
  function resolveDestructured(
    file: ModuleFile,
    declaration: ts.VariableDeclaration,
    path: string[],
    name: string
  ): Resolution {
    // A `for…of` binding carries no initializer of its own: the value it
    // reads is one element of the iterated expression, which the loop names.
    if (declaration.initializer === undefined) {
      return resolveIterated(file, declaration, path, name);
    }
    // declaration.name alone might match other local declarations and pollute
    // the memoization cache.
    const label = declaration.name.getText().replace(/\s+/g, ' ');

    let resolution = memoizedAnalyze(file, declaration.initializer, label);
    for (const property of path) {
      resolution = memberOf(resolution, property);
    }
    return resolution;
  }

  /**
   * Resolve `for…of` bindings. Only resolve when every element resolves
   * identically. We're doing static analysis and wanna steer clear of
   * taint analysis or abstract interpretation methods.
   */
  function resolveIterated(
    file: ModuleFile,
    declaration: ts.VariableDeclaration,
    path: string[],
    name: string
  ): Resolution {
    const elements = iteratedElements(declaration);
    if (elements === null) {
      return unresolved(
        `'${name}' is destructured from a declaration with no value in ${file.path}`
      );
    }
    if (elements === 'opaque') {
      return unresolved(
        `'${name}' is a loop binding over elements that are not statically known in ${file.path}`
      );
    }
    // The body never runs, so no iteration attributes the name anything.
    if (elements.length === 0) {
      return unresolved(`'${name}' is a loop binding over an empty array in ${file.path}`);
    }

    // Labelled by the pattern rather than by `name`, for the reason given in
    // `resolveDestructured`.
    const label = declaration.name.getText().replace(/\s+/g, ' ');
    const resolutions = elements.map((element) => {
      let resolution = memoizedAnalyze(file, element, label);
      for (const property of path) resolution = memberOf(resolution, property);
      return resolution;
    });

    // One unattributable element sinks the loop, and its own reason is the
    // honest one to report.
    const unattributable = resolutions.find((resolution) => identityKey(resolution) === null);
    if (unattributable !== undefined) {
      return unattributable.category === 'unresolved'
        ? unattributable
        : unresolved(`'${name}' is destructured from a non-component element in ${file.path}`);
    }

    const first = resolutions[0] as Resolution;
    const key = identityKey(first);
    if (resolutions.some((resolution) => identityKey(resolution) !== key)) {
      return unresolved(
        `'${name}' is destructured from array elements that disagree in ${file.path}`
      );
    }
    return first;
  }

  function memoizedAnalyze(file: ModuleFile, node: ts.Node, name: string): Resolution {
    // Check cache first.
    const cached = declarationCache.get(node);
    if (cached !== undefined) {
      return cached;
    }

    // Detect ongoing circular reference loop.
    if (declarationsInFlight.has(node)) {
      return circularPlaceholder(`circular declaration for '${name}' in ${file.path}`);
    }
    declarationsInFlight.add(node);

    // Perform analysis.
    const placeholdersBefore = circularPlaceholders;
    try {
      const resolution = analyzeDeclaration(file, node, name, resolver);
      if (circularPlaceholders === placeholdersBefore) declarationCache.set(node, resolution);
      return resolution;
    } finally {
      declarationsInFlight.delete(node);
    }
  }

  // Resolve a member of an object.
  function memberOf(resolution: Resolution, property: string): Resolution {
    // The compound-component pattern first: `Card.Header = Header` beside the
    // declaration wins over whatever Card itself resolved into.
    if (resolution.category !== 'namespace' && resolution.category !== 'object') {
      const site = resolution.declaredAt;
      const assigned = site?.file.propertyAssignments.get(`${site.name}.${property}`);
      if (site && assigned) return memoizedAnalyze(site.file, assigned, property);
    }

    switch (resolution.category) {
      case 'namespace':
        return resolution.module.kind === 'package'
          ? packageIdentity(resolution.module.specifier, property)
          : resolveExport(resolution.module.path, property);
      case 'ds':
      case 'external': {
        // A member of a default import is a member of the module itself
        // (`React.memo`, `Lottie.Player`), not of a component named `default`.
        const name = resolution.name === 'default' ? property : `${resolution.name}.${property}`;
        return { category: resolution.category, module: resolution.module, name };
      }
      case 'wrapped-ds': {
        // Member access on a subsetting wrapper (no compound-component
        // assignment matched above) projects the same member off the DS
        // identity it collapses to.
        const name =
          resolution.ds.name === 'default' ? property : `${resolution.ds.name}.${property}`;
        return { category: 'ds', module: resolution.ds.module, name };
      }
      case 'object': {
        for (const objectProperty of resolution.node.properties) {
          if (
            ts.isPropertyAssignment(objectProperty) &&
            (ts.isIdentifier(objectProperty.name) || ts.isStringLiteral(objectProperty.name)) &&
            objectProperty.name.text === property
          ) {
            return memoizedAnalyze(resolution.file, objectProperty.initializer, property);
          }
          if (
            ts.isShorthandPropertyAssignment(objectProperty) &&
            objectProperty.name.text === property
          ) {
            return resolveLocal(resolution.file, property);
          }
        }
        return unresolved(`no property '${property}' on object in ${resolution.file.path}`);
      }
      case 'local': {
        const file = graph.files.get(resolution.module);
        const assigned = file?.propertyAssignments.get(`${resolution.name}.${property}`);
        if (file && assigned) return memoizedAnalyze(file, assigned, property);
        return unresolved(`unresolved member '${resolution.name}.${property}'`);
      }
      case 'host':
        return unresolved(`member access on intrinsic '${resolution.tag}'`);
      case 'unresolved':
        return resolution;
    }
  }

  const resolver: IdentityResolver = {
    resolveLocal,
    resolveExport,
    resolveModule,
    memberOf,
    resolveDestructured,
    analyzeDeclaration: memoizedAnalyze,
  };
  return resolver;
}
