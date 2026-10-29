import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { glob } from 'tinyglobby';

import { esMain } from '../utils/esmain.ts';
import type { SourceFile } from './check-no-presets-apply.ts';

/** Node code whose state must hang off its Storybook instance, relative to `code/`. */
export const GUARDED_PATHS = [
  'core/src/instance/',
  'core/src/services/',
  'core/src/shared/open-service/toolset-registry.ts',
  'core/src/shared/open-service/toolsets/',
  // Shared with the browser; must not grow a module realm again.
  'core/src/shared/universal-store/',
  'core/src/shared/status-store/',
  'core/src/shared/test-provider-store/',
  'lib/open-service/src/',
  'addons/mcp/src/mcp-handler.ts',
  'addons/mcp/src/node/',
  'addons/vitest/src/node/',
];

const CODE_DIRECTORY = fileURLToPath(new URL('../../code/', import.meta.url));
// Formatted top-level declarations start at column 0; nested ones are indented.
const MODULE_LET = /^(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)/gm;
const FALLBACK = /\bFALLBACK_[A-Z0-9_]+\b/g;
const SOURCE_GLOB = 'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const TEST_SOURCES = [
  '**/*.test.*',
  '**/*.test-d.*',
  '**/*.test-helpers.*',
  '**/*.stories.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/__fixtures__/**',
  '**/__testfixtures__/**',
];

/** List `file:line name` for each module-level `let`/`var` or `FALLBACK_*` in guarded code. */
export function findNodeGlobals(sources: SourceFile[]): string[] {
  return sources
    .filter(({ file }) => isGuardedFile(file))
    .flatMap(({ file, code }) =>
      [...code.matchAll(MODULE_LET), ...code.matchAll(FALLBACK)]
        .sort((a, b) => a.index - b.index)
        .map(
          (match) =>
            `${file}:${code.slice(0, match.index).split('\n').length} ${match[1] ?? match[0]}`
        )
    );
}

/** Whether `file`, relative to `code/`, must keep its state on the instance. */
export function isGuardedFile(file: string): boolean {
  return GUARDED_PATHS.some((entry) =>
    entry.endsWith('/') ? file.startsWith(entry) : file === entry
  );
}

/** Prints the module-level state a package keeps in guarded code; returns `false` when there is any. */
export async function checkNoNodeGlobals(packageDir: string): Promise<boolean> {
  const files = await glob(SOURCE_GLOB, {
    cwd: packageDir,
    ignore: ['**/node_modules/**', '**/dist/**', ...TEST_SOURCES],
  });
  const found = findNodeGlobals(
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
    `${packageDir}: keep Node state on the Storybook instance (context state, a WeakMap keyed by the instance, or a closure created in setup), not in module variables:`
  );
  for (const declaration of found) {
    console.log(`  ${declaration}`);
  }
  return false;
}

if (esMain(import.meta.url)) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const dirs = positionals.length > 0 ? positionals : [process.cwd()];
  let ok = true;
  for (const dir of dirs) {
    ok = (await checkNoNodeGlobals(resolve(dir))) && ok;
  }
  process.exit(ok ? 0 : 1);
}
