import { readFile, rename, writeFile } from 'node:fs/promises';

import { join } from 'pathe';
import sortPackageJson from 'sort-package-json';

import type { BuildEntries } from './entry-utils.ts';

const DEEP_PREFIX = './internal/deep/';

export async function generatePackageJsonFile(cwd: string, data: BuildEntries) {
  const location = join(cwd, 'package.json');
  const raw = await readFile(location, { encoding: 'utf8' });
  const pkgJson = JSON.parse(raw);

  const { entries } = data;

  // Add the package.json file to the exports, so we can use it to `require.resolve` the package's root easily
  pkgJson.exports = {
    './package.json': './package.json',
    ...data.extraOutputs,
  };

  // A key built for both the node and another platform resolves per platform via a `node` condition.
  const nodeOnly = new Map<string, string>();
  for (const [platform, platformEntries] of Object.entries(entries)) {
    for (const entry of platformEntries ?? []) {
      for (const exportEntry of entry.exportEntries ?? []) {
        const dtsPath = entry.entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.d.ts');
        const jsPath = entry.outputPath
          ? `./dist/${entry.outputPath}.js`
          : entry.entryPoint.replace('src', 'dist').replace(/\.tsx?/, '.js');

        if (platform === 'node' && entry.dts === false && entries.browser?.some((other) => other.exportEntries?.includes(exportEntry))) {
          nodeOnly.set(exportEntry, jsPath);
        } else if (entry.dts === undefined) {
          pkgJson.exports[exportEntry] = {
            code: entry.entryPoint,
            types: dtsPath,
            default: jsPath,
          };
        } else {
          pkgJson.exports[exportEntry] = jsPath;
        }
      }
    }
  }
  for (const [exportEntry, nodePath] of nodeOnly) {
    const { code, types, default: defaultPath } = pkgJson.exports[exportEntry];
    pkgJson.exports[exportEntry] = { code, types, node: nodePath, default: defaultPath };
  }

  if (data.deepExportsPattern) {
    pkgJson.exports = collapseDeepExports(pkgJson.exports);
  }

  pkgJson.exports = sortObject(pkgJson.exports);

  const sorted = sortPackageJson(pkgJson);
  sorted.exports = putCodeConditionFirst(sorted.exports);
  const updated = `${JSON.stringify(sorted, null, 2)}\n`;
  if (updated === raw) {
    return;
  }

  // Package builds run concurrently, and every build's boot resolves modules
  // under every other package's directory (entry-configs.ts imports each
  // package's build-config.ts), which makes Node's ESM loader read these
  // package.json files for package-scope detection. A plain writeFile briefly
  // truncates the file, and a concurrent reader then crashes with
  // ERR_INVALID_PACKAGE_CONFIG. Write-then-rename keeps the file valid at
  // every instant.
  const tempLocation = join(cwd, `.package.json.${process.pid}.tmp`);
  await writeFile(tempLocation, updated);
  await rename(tempLocation, location);
}

/**
 * Replaces each `./internal/deep/<path>` key built from `./src/<path>.ts` with default outputs by
 * one subpath pattern; keys with another source file, output path or condition stay explicit.
 */
export function collapseDeepExports(exports: Record<string, any>): Record<string, any> {
  const collapsed: Record<string, any> = {};
  let matched = false;
  for (const [key, value] of Object.entries(exports)) {
    const path = key.startsWith(DEEP_PREFIX) ? key.slice(DEEP_PREFIX.length) : undefined;
    const uniform =
      path !== undefined &&
      typeof value === 'object' &&
      Object.keys(value).length === 3 &&
      value.code === `./src/${path}.ts` &&
      value.types === `./dist/${path}.d.ts` &&
      value.default === `./dist/${path}.js`;
    if (uniform) {
      matched = true;
    } else {
      collapsed[key] = value;
    }
  }
  if (matched) {
    collapsed[`${DEEP_PREFIX}*`] = {
      code: './src/*.ts',
      types: './dist/*.d.ts',
      default: './dist/*.js',
    };
  }
  return collapsed;
}

/**
 * Moves the `code` condition ahead of `types`, which sort-package-json always puts first.
 *
 * TypeScript picks the first matching condition, so with `types` first a workspace type check
 * reads built `.d.ts` files when they exist and falls back to `src` when they don't, mixing two
 * copies of the same declarations depending on what was compiled.
 */
export function putCodeConditionFirst<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(putCodeConditionFirst) as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const entries = Object.entries(value).map(([key, target]) => [key, putCodeConditionFirst(target)]);
  return Object.fromEntries(
    entries.sort(([a], [b]) => Number(b === 'code') - Number(a === 'code'))
  ) as T;
}

function sortObject(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
