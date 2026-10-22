import { readFileSync, realpathSync } from 'node:fs';

import type { Plugin } from 'esbuild';
import { basename, dirname, join, normalize, parse } from 'pathe';

/*
 * Manager entries run only for their side effects: mark each entry, and every module inside the
 * entry's own package, `sideEffects: true`, so the package's `"sideEffects": false` cannot drop
 * the registration (#21335). Dependencies that an entry imports stay tree-shakable.
 */

/*
 * `build.resolve` runs this plugin's own `onResolve` callback again for the nested resolution;
 * the sentinel passed through `pluginData` lets the nested call defer to default resolution.
 */
const reentryGuard = Symbol('preserve-manager-entry-side-effects-reentry');

/*
 * Reads the package.json directly in `dir`, tolerating its absence or malformed JSON: such a
 * manifest carries no `name` or `sideEffects` annotation, and walking past it errs toward marking
 * more modules as side-effectful, never fewer.
 */
const readPackageJson = (dir: string): { name?: unknown; sideEffects?: unknown } | undefined => {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
};

/*
 * The nearest package root of a file: the closest ancestor directory whose package.json has a
 * `name` or a `sideEffects` field (the annotation esbuild applies), skipping inner manifests like
 * `dist/esm/package.json` that only carry `{"type": "module"}`. Stops at `node_modules`: modules
 * under a nested node_modules belong to dependencies, not to the entry's own package.
 */
export const findPackageRoot = (file: string): string | undefined => {
  let dir = dirname(file);
  for (const root = parse(file).root; dir !== root; dir = dirname(dir)) {
    if (basename(dir) === 'node_modules') {
      return undefined;
    }
    const pkg = readPackageJson(dir);
    if (pkg && (pkg.name != null || pkg.sideEffects != null)) {
      return dir;
    }
  }
  return undefined;
};

/*
 * True when `path` resolves inside one of `packageRoots`, unless it is reached through a nested
 * `node_modules`: modules there belong to dependencies of the entry's package, not to the package
 * itself. Roots and paths are normalized first, so a native Windows path (`C:\...`) matches its
 * `C:/...` root.
 */
export const createInsideEntryPackageMatcher =
  (packageRoots: Iterable<string>) =>
  (path: string): boolean => {
    const normalizedPath = normalize(path);
    return [...packageRoots].some((root) => {
      const canonicalRoot = normalize(root);
      if (!normalizedPath.startsWith(`${canonicalRoot}/`)) {
        return false;
      }
      const relativePath = normalizedPath.slice(canonicalRoot.length + 1);
      return !relativePath.split('/').includes('node_modules');
    });
  };

export function preserveManagerEntrySideEffectsPlugin(wrappedEntries: string[]): Plugin {
  // esbuild reports importers and resolved paths as real paths (symlinks resolved) with native
  // separators on Windows, so canonicalize the wrapper paths the same way before comparing.
  const wrappers = new Set(wrappedEntries.map((p) => normalize(realpathSync(p))));
  const entryRoots = new Set<string>();
  const isInsideEntryPackage = createInsideEntryPackageMatcher(entryRoots);

  return {
    name: 'preserve-manager-entry-side-effects',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData === reentryGuard) {
          return undefined;
        }
        // Entry points themselves have no importer and are always emitted; every protected import
        // originates from a wrapper or from inside an entry's package, so skip everything else
        // without resolving.
        if (!args.importer) {
          return undefined;
        }
        const importer = normalize(args.importer);
        if (!wrappers.has(importer) && !isInsideEntryPackage(args.importer)) {
          return undefined;
        }
        // Resolve through esbuild instead of joining paths by hand: bare specifiers,
        // extensionless and directory imports must resolve identically to default resolution.
        const result = await build.resolve(args.path, {
          importer: args.importer,
          kind: args.kind,
          resolveDir: args.resolveDir,
          namespace: args.namespace,
          pluginData: reentryGuard,
        });
        if (!result.path || result.external) {
          return undefined;
        }
        const resolved = normalize(result.path);
        // A wrapper imports its entry for its side effects only, so the entry is always marked;
        // its package root is recorded to protect the entry's own registration imports too.
        if (wrappers.has(importer)) {
          const packageRoot = findPackageRoot(resolved);
          if (packageRoot) {
            entryRoots.add(normalize(packageRoot));
          }
        } else if (!isInsideEntryPackage(resolved)) {
          return undefined;
        }
        return {
          path: result.path,
          namespace: result.namespace,
          suffix: result.suffix,
          pluginData: result.pluginData,
          sideEffects: true,
        };
      });
    },
  };
}
