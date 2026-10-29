import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { glob } from 'tinyglobby';

import { esMain } from '../utils/esmain.ts';

/** A non-test source file, relative to `code/`, with its contents. */
export interface SourceFile {
  /** Path relative to `code/`, with `/` separators. */
  file: string;
  code: string;
}

/** Files that may still call `presets.apply`: the compat layer that bridges legacy presets. */
export const COMPAT_FILES = [
  'core/src/instance/legacy-hooks.ts',
  'core/src/instance/legacy-preset.ts',
  'lib/storybook/src/storybook/compat/',
];

const CODE_DIRECTORY = fileURLToPath(new URL('../../code/', import.meta.url));
const PRESETS_APPLY = /\bpresets\s*\??\s*\.\s*apply\s*(?:<[^()]*>)?\s*\(/g;
const SOURCE_GLOB = 'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const TEST_SOURCES = [
  '**/*.test.*',
  '**/*.test-d.*',
  '**/*.stories.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/__fixtures__/**',
  '**/__testfixtures__/**',
];

/** List `file:line` for every `presets.apply(` call outside the compat layer. */
export function findPresetsApplyCalls(sources: SourceFile[]): string[] {
  return sources
    .filter(({ file }) => !isCompatFile(file))
    .flatMap(({ file, code }) =>
      [...code.matchAll(PRESETS_APPLY)].map(
        (match) => `${file}:${code.slice(0, match.index).split('\n').length}`
      )
    );
}

/** Whether `file`, relative to `code/`, belongs to the compat layer. */
export function isCompatFile(file: string): boolean {
  return COMPAT_FILES.some((entry) =>
    entry.endsWith('/') ? file.startsWith(entry) : file === entry
  );
}

/** Prints the `presets.apply` calls a package still makes; returns `false` when there is any. */
export async function checkNoPresetsApply(packageDir: string): Promise<boolean> {
  const files = await glob(SOURCE_GLOB, {
    cwd: packageDir,
    ignore: ['**/node_modules/**', '**/dist/**', ...TEST_SOURCES],
  });
  const found = findPresetsApplyCalls(
    await Promise.all(
      files.sort().map(async (file) => ({
        file: relative(CODE_DIRECTORY, join(packageDir, file)).replaceAll('\\', '/'),
        code: await readFile(join(packageDir, file), 'utf8'),
      }))
    )
  );
  if (found.length === 0) {
    return true;
  }
  console.log(
    `${packageDir}: only the compat layer may call presets.apply; use storybook.callHook or the instance API instead:`
  );
  for (const call of found) {
    console.log(`  ${call}`);
  }
  return false;
}

if (esMain(import.meta.url)) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const dirs = positionals.length > 0 ? positionals : [process.cwd()];
  let ok = true;
  for (const dir of dirs) {
    ok = (await checkNoPresetsApply(resolve(dir))) && ok;
  }
  process.exit(ok ? 0 : 1);
}
