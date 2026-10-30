import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

import { glob } from 'tinyglobby';

import { esMain } from '../utils/esmain.ts';

/** What a package ships that decides whether it still has the legacy preset shape. */
export interface PackageShape {
  /** The package.json `exports` map. */
  exports: Record<string, unknown>;
  /** File names at the package root. */
  rootFiles: string[];
  /** Non-test source files, relative to the package directory, with their contents. */
  sources: { file: string; code: string }[];
}

const CODE_DIRECTORY = fileURLToPath(new URL('../../code/', import.meta.url));
/** Directories, relative to `code/`, whose packages are addons with a single `<pkg>/node` entry. */
const PLUGIN_PACKAGE_GROUPS = ['addons', 'builders', 'frameworks', 'presets', 'renderers'];
const PRESET_EXPORT = /^\.\/(?:preset|server\/framework-preset)/;
const ROOT_PRESET_FILE = /^preset\.(?:c|m)?js$/;
const PRESETS_APPLY = /\bpresets\??\.apply\b/;
const SOURCE_GLOB = 'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const TEST_SOURCES = ['**/*.test.*', '**/*.test-d.*', '**/*.stories.*', '**/__tests__/**'];

/** List why an addon package still has the legacy preset shape; empty when it has none. */
export function findPresetShape({ exports, rootFiles, sources }: PackageShape): string[] {
  return [
    ...Object.keys(exports)
      .filter((key) => PRESET_EXPORT.test(key) && !isNodeAlias(exports, key))
      .map((key) => `exports "${key}"`),
    ...rootFiles.filter((file) => ROOT_PRESET_FILE.test(file)).map((file) => `ships root ${file}`),
    ...sources
      .filter(({ code }) => PRESETS_APPLY.test(code))
      .map(({ file }) => `calls presets.apply in ${file}`),
  ];
}

/** Whether `packageDir` holds an official addon package that must not ship a preset. */
export function isPluginPackage(packageDir: string): boolean {
  const [group] = relative(CODE_DIRECTORY, packageDir).split(/[\\/]/);
  return PLUGIN_PACKAGE_GROUPS.includes(group);
}

/** Prints the preset shape an addon package still has; returns `false` when there is any. */
export async function checkNoPresetShape(packageDir: string): Promise<boolean> {
  if (!isPluginPackage(packageDir)) {
    return true;
  }
  const { exports = {} } = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
  const files = await glob(SOURCE_GLOB, {
    cwd: packageDir,
    ignore: ['**/node_modules/**', '**/dist/**', ...TEST_SOURCES],
  });
  const found = findPresetShape({
    exports: typeof exports === 'object' ? exports : {},
    rootFiles: await readdir(packageDir),
    sources: await Promise.all(
      files.sort().map(async (file) => ({
        file,
        code: await readFile(join(packageDir, file), 'utf8'),
      }))
    ),
  });
  if (found.length === 0) {
    return true;
  }
  console.log(
    `${packageDir}: official packages register through their <pkg>/node addon only; move this into node.ts modules and use storybook.callHook instead of presets.apply:`
  );
  for (const reason of found) {
    console.log(`  ${reason}`);
  }
  return false;
}

/** Third-party framework presets still resolve `<renderer>/preset`, so an exact `./node` alias is allowed. */
function isNodeAlias(exports: Record<string, unknown>, key: string): boolean {
  return (
    key === './preset' && './node' in exports && isDeepStrictEqual(exports[key], exports['./node'])
  );
}

if (esMain(import.meta.url)) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const dirs = positionals.length > 0 ? positionals : [process.cwd()];
  let ok = true;
  for (const dir of dirs) {
    ok = (await checkNoPresetShape(resolve(dir))) && ok;
  }
  process.exit(ok ? 0 : 1);
}
