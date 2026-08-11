/**
 * On-demand Compodoc: makes sure `documentation.json` has been generated for this Storybook run.
 *
 * Compodoc scans the whole project in one pass, so the unit of work is the whole run: the first
 * caller generates and the rest of the run reuses what it produced.
 */
import { withFileLock } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import { generateDocumentation } from './generate-documentation.ts';

/** Lock file name, kept beside the output so it inherits the same directory and filesystem. */
export const COMPODOC_LOCK = '.compodoc.lock';

/** Records which run produced the `documentation.json` sitting next to it. */
export const COMPODOC_RUN_MARKER = '.compodoc.run';

const RUN_ID_ENV = 'STORYBOOK_COMPODOC_RUN_ID';

/**
 * Identifies one Storybook run. Held in the environment so worker threads and the Vitest addon's
 * child, which inherit it, agree with the process that started the run instead of each scanning.
 */
const currentRunId = (): string => (process.env[RUN_ID_ENV] ??= randomUUID());

const markerRunId = (markerPath: string): string | undefined => {
  try {
    return readFileSync(markerPath, 'utf8').trim();
  } catch {
    return undefined;
  }
};

export interface EnsureDocumentationOptions {
  compodocArgs: string[];
  tsconfig: string;
  workspaceRoot: string;
  outputDir: string;
  /**
   * How long to wait on another process's run.
   */
  waitBudgetMs?: number;
}

/**
 * Generates `documentation.json` unless this run already did. Failures are logged, never thrown:
 * docgen degrades to "no metadata", it does not break the build.
 */
export const ensureCompodocDocumentation = async ({
  compodocArgs,
  tsconfig,
  workspaceRoot,
  outputDir,
  waitBudgetMs,
}: EnsureDocumentationOptions): Promise<void> => {
  const markerPath = join(outputDir, COMPODOC_RUN_MARKER);
  const runId = currentRunId();

  if (markerRunId(markerPath) === runId) {
    return;
  }

  try {
    const outcome = await withFileLock(
      join(outputDir, COMPODOC_LOCK),
      async () => {
        // Re-read under the lock: the process we queued behind may have generated for this same run.
        if (markerRunId(markerPath) === runId) {
          return;
        }
        await generateDocumentation({ compodocArgs, tsconfig, workspaceRoot, outputDir });
        // Written only after a successful publish, so a failed run leaves the marker alone and the
        // next caller retries.
        writeFileSync(markerPath, runId);
      },
      { waitBudgetMs }
    );

    if (outcome === 'busy') {
      logger.debug(
        `[storybook-angular-vite] another process is still generating ${DOCUMENTATION_JSON}; continuing with what is on disk`
      );
    }
  } catch (error) {
    logger.warn(
      `[storybook-angular-vite] Compodoc generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
