import { existsSync } from 'node:fs';

import type { Plugin } from 'esbuild';
import { basename, dirname, join, normalize, parse } from 'pathe';

/*
 * Manager entries are self-invoking modules (see `wrapManagerEntries`): their entire behavior is
 * import-time side effects. Once esbuild honors `"sideEffects": false` in package.json, it would
 * tree-shake such entries away entirely when the package they belong to declares it. The wrapper
 * files exist only to import their entry for those side effects, so whatever a wrapper imports is
 * marked side-effectful. This keeps the fix from PR #21335 (`manager.js` ignored when
 * `sideEffects: false` in `package.json`) working, for which `ignoreAnnotations: true` was a
 * blanket workaround.
 *
 * Marking entries alone is not enough: an entry's own package can declare `"sideEffects": false`
 * too, and its registration imports one level below the entry (`import './register.js'`, or a
 * split `import './chunk-XYZ.js'`) would then be dropped while the entry itself survives. Modules
 * resolving inside the package root of a manager entry are therefore marked side-effectful as
 * well. Packages merely imported BY an entry (e.g. @storybook/icons) are outside every entry's
 * package root and keep their declared behavior, staying tree-shakable.
 */

/*
 * `build.resolve` runs this plugin's own `onResolve` callback again for the nested resolution;
 * the sentinel passed through `pluginData` lets the nested call defer to default resolution.
 */
const reentryGuard = Symbol('preserve-manager-entry-side-effects-reentry');

/*
 * The nearest package root of an entry file, stopping at `node_modules`: modules under a nested
 * node_modules belong to dependencies, not to the entry's own package.
 */
export const findPackageRoot = (file: string): string | undefined => {
  let dir = dirname(file);
  for (const root = parse(file).root; dir !== root; dir = dirname(dir)) {
    if (basename(dir) === 'node_modules') {
      return undefined;
    }
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
  }
  return undefined;
};

export function preserveManagerEntrySideEffectsPlugin(wrappedEntries: string[]): Plugin {
  // esbuild reports paths with forward slashes on every platform; the wrappers are generated with
  // native separators on Windows, so normalize once here instead of comparing raw strings.
  const wrappers = new Set(wrappedEntries.map((p) => normalize(p)));
  const entryRoots = new Set<string>();

  const isInsideEntryPackage = (path: string) =>
    [...entryRoots].some((root) => {
      if (!path.startsWith(`${root}/`)) {
        return false;
      }
      const relativePath = path.slice(root.length + 1);
      return !relativePath.split('/').includes('node_modules');
    });

  return {
    name: 'preserve-manager-entry-side-effects',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (
          args.pluginData === reentryGuard ||
          (!wrappers.has(args.importer) && entryRoots.size === 0)
        ) {
          return undefined;
        }
        // Resolve through esbuild instead of joining paths by hand: bare specifiers,
        // extensionless and directory imports must resolve identically to default resolution.
        const { path, external } = await build.resolve(args.path, {
          importer: args.importer,
          kind: args.kind,
          resolveDir: args.resolveDir,
          namespace: args.namespace,
          pluginData: reentryGuard,
        });
        if (!path || external) {
          return undefined;
        }
        // A wrapper imports its entry for its side effects only; keep it and record the entry's
        // package root for the general rule below.
        if (wrappers.has(args.importer)) {
          const packageRoot = findPackageRoot(path);
          if (packageRoot) {
            entryRoots.add(packageRoot);
          }
          return { path, sideEffects: true };
        }
        if (isInsideEntryPackage(path)) {
          return { path, sideEffects: true };
        }
        return undefined;
      });
    },
  };
}
