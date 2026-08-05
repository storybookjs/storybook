/**
 * On-demand Compodoc: brings `documentation.json` up to date, or explains why it could not.
 *
 * A plain async function over plain data, so the docgen worker thread, the framework preset and a
 * bare Node script can all call it and serialise against each other through one lock file. Freshness
 * is checked once per caller, so a component edited while the dev server runs stays stale until
 * restart. The user-facing consequences of that live in the Angular Vite docs page.
 */
import { logger } from 'storybook/internal/node-logger';

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import { withFileLock } from './file-lock.ts';
import { generateDocumentation } from './generate-documentation.ts';

/** Lock file name, kept beside the output so it inherits the same directory and filesystem. */
export const COMPODOC_LOCK = '.compodoc.lock';

/**
 * Directories no Compodoc run reads, skipped so the freshness walk stays cheap on a real workspace.
 * Build output matters most: it is regenerated constantly and would report a change on every start.
 */
const SKIPPED_DIRECTORY_NAMES = new Set([
  'node_modules',
  '.git',
  '.nx',
  '.angular',
  'dist',
  'out-tsc',
  'coverage',
  'storybook-static',
]);

/** Mirrors Compodoc's own `INCLUDE_PATTERNS` / `EXCLUDE_PATTERNS`. */
const isScannedSource = (fileName: string): boolean =>
  (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) &&
  !fileName.endsWith('.d.ts') &&
  !fileName.endsWith('.spec.ts');

const statOrUndefined = (path: string) => {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
};

/**
 * Newest mtime among the sources Compodoc would read under `workspaceRoot`, or `undefined` when there
 * are none.
 *
 * Scanning from `workspaceRoot` rather than from the tsconfig's directory is deliberate: Compodoc
 * runs there, and a tsconfig's `include` relocates the scan rather than narrowing it. Storybook's own
 * Angular template ships `.storybook/tsconfig.json` with `include: ["../src/**\/*.ts"]`, so anything
 * derived from the tsconfig's own directory would miss every component. Over-approximating costs one
 * extra scan; under-approximating serves stale metadata forever.
 *
 * Symlinked directories are not followed, so a source tree reachable only through one is invisible.
 */
export const newestSourceMtimeMs = (workspaceRoot: string): number | undefined => {
  let newest: number | undefined;

  const walk = (directory: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      // An unreadable directory contributes nothing; it is not evidence of a change.
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
          walk(join(directory, entry.name));
        }
      } else if (entry.isFile() && isScannedSource(entry.name)) {
        const stats = statOrUndefined(join(directory, entry.name));
        if (stats && (newest === undefined || stats.mtimeMs > newest)) {
          newest = stats.mtimeMs;
        }
      }
    }
  };

  walk(resolve(workspaceRoot));
  return newest;
};

/**
 * Whether `documentation.json` can be served as it stands.
 *
 * A zero-length file counts as stale, since that is what Compodoc's own non-atomic write looks like
 * when caught mid-flight. A source sharing the file's exact timestamp counts as stale too: coarse
 * filesystem timestamps report an edit made moments later as the same instant.
 */
export const isDocumentationFresh = (
  documentationJsonPath: string,
  newestSourceMs: number | undefined
): boolean => {
  const stats = statOrUndefined(documentationJsonPath);
  if (!stats?.isFile() || stats.size === 0) {
    return false;
  }
  return newestSourceMs === undefined || stats.mtimeMs > newestSourceMs;
};

export interface EnsureDocumentationOptions {
  compodocArgs: string[];
  tsconfig: string;
  workspaceRoot: string;
  outputDir: string;
  /**
   * How long to wait on another process's run. Kept short by default because `viteFinal` runs inside
   * addon-vitest's child, which aborts after 30 seconds of boot. Giving up beats failing the boot:
   * the docgen reader re-resolves `documentation.json` per request, so a late file is still picked up.
   */
  waitBudgetMs?: number;
}

/**
 * Makes `documentation.json` current if it is not already. Failures are logged, never thrown: docgen
 * degrades to "no metadata", it does not break the build.
 */
export const ensureCompodocDocumentation = async ({
  compodocArgs,
  tsconfig,
  workspaceRoot,
  outputDir,
  waitBudgetMs,
}: EnsureDocumentationOptions): Promise<void> => {
  const documentationJson = join(outputDir, DOCUMENTATION_JSON);
  // Walked once. Only `documentation.json`'s own mtime can change while we wait for the lock, and a
  // source edited during the wait regenerates on the next start, which is the documented contract.
  const newestSourceMs = newestSourceMtimeMs(workspaceRoot);

  if (isDocumentationFresh(documentationJson, newestSourceMs)) {
    return;
  }

  try {
    const outcome = await withFileLock(
      join(outputDir, COMPODOC_LOCK),
      async () => {
        // Re-checked under the lock, so a waiter takes the winner's output instead of rescanning.
        if (isDocumentationFresh(documentationJson, newestSourceMs)) {
          return;
        }
        await generateDocumentation({ compodocArgs, tsconfig, workspaceRoot, outputDir });
      },
      { waitBudgetMs }
    );

    if (outcome === 'busy') {
      logger.debug(
        `[storybook-angular-vite] another process is still generating ${DOCUMENTATION_JSON}; continuing without it`
      );
    }
  } catch (error) {
    logger.warn(
      `[storybook-angular-vite] Compodoc generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
