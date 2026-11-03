import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type * as esbuild from 'esbuild';
import { join, normalize } from 'pathe';

/**
 * Third-party modules that a chunked runtime emits as stable entries under
 * `dist/<runtime dir>/vendor/`, and that the browser entries of the same package import from there
 * instead of bundling another copy. See `BuildEntry.sharedModules`.
 */
export type SharedRuntimeModules = { outDir: string; specifiers: readonly string[] };

/** `@vitest/utils/error` -> `vitest-utils-error` */
export const sharedModuleName = (specifier: string) =>
  specifier.replace(/^@/, '').replaceAll('/', '-');

/** The path of a shared module's entry, relative to `dist`. */
export const sharedModuleFile = (outDir: string, specifier: string) =>
  `${outDir}/vendor/${sharedModuleName(specifier)}.js`;

/**
 * Marks the shared modules as external imports of the runtime's vendor entries. The specifier is
 * relative to the output file, which esbuild can't know at resolve time, so it assumes outputs one
 * directory deep (`dist/<entry dir>/*.js`, `dist/_browser-chunks/*.js`); the package's
 * declaration contract test checks that each import resolves.
 */
export function sharedRuntimeModulesPlugin({
  outDir,
  specifiers,
}: SharedRuntimeModules): esbuild.Plugin {
  const shared = new Set(specifiers);
  return {
    name: 'storybook:shared-runtime-modules',
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, ({ path }) =>
        shared.has(path) ? { path: `../${sharedModuleFile(outDir, path)}`, external: true } : null
      );
    },
  };
}

/**
 * The packages behind `specifiers` and all their dependencies, as package directories. Throws if one
 * doesn't resolve, rather than leaving it out of the shared chunks.
 */
export function collectPackageDirs(specifiers: readonly string[], cwd: string): string[] {
  const dirs = new Set<string>();
  const packageDirOf = (resolved: string, name: string) => {
    const marker = `/node_modules/${name}/`;
    const index = resolved.lastIndexOf(marker);
    return index === -1 ? null : resolved.slice(0, index + marker.length - 1);
  };
  const packageName = (specifier: string) =>
    specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');

  const resolve = (name: string, from: string) => {
    const require = createRequire(join(from, 'noop.js'));
    try {
      return normalize(require.resolve(`${name}/package.json`));
    } catch {
      // Its `exports` don't expose package.json.
      return normalize(require.resolve(name));
    }
  };

  const visit = (name: string, from: string) => {
    const resolved = resolve(name, from);
    const dir = packageDirOf(resolved, name);
    if (!dir || dirs.has(dir)) {
      return;
    }
    dirs.add(dir);
    const { dependencies = {} } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(dependencies)) {
      visit(dependency, dir);
    }
  };

  for (const specifier of specifiers) {
    visit(packageName(specifier), cwd);
  }
  return [...dirs];
}

/** Whether a module id is a file of one of the package directories. */
export const isInPackageDirs = (dirs: readonly string[]) => (id: string) => {
  const path = normalize(id.split('?')[0]);
  return dirs.some((dir) => path.startsWith(`${dir}/`));
};
