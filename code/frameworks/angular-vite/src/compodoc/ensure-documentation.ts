/**
 * On-demand Compodoc: makes `documentation.json` current, or explains why it could not.
 *
 * This is a plain async function over plain data. It needs no dev server, no Vite config and no
 * Angular builder context, so the docgen worker thread, the framework preset and a bare Node script
 * can all call it, and they all serialise against each other through one lock file.
 *
 * ## What regenerates, and what does not
 *
 * A run happens when `documentation.json` is missing, empty, or older than the newest `.ts` file
 * under the directory Compodoc scans - checked once, when the caller starts. In practice that means
 * once per `storybook dev`, once per `storybook build`, once per Vitest process, and never again in
 * that process's lifetime.
 *
 * Editing a component while the dev server is running does **not** regenerate it. `argTypes`,
 * descriptions and JSDoc tags stay as they were at startup until Storybook is restarted - that is
 * what "stale until restart" means here. Compodoc has no watch mode that helps: `compodoc -e json
 * -w` exits immediately without watching, and the only watching entry point it has requires its HTTP
 * documentation server to hold a port for the whole session.
 *
 * ## Limits of the staleness check
 *
 * - Only the sources Compodoc reads count: `.ts` and `.tsx` under the tsconfig's directory, minus
 *   `.d.ts` and `.spec.ts`. Changing a `templateUrl` HTML file or a `styleUrls` SCSS file changes
 *   `documentation.json`, and that reaches stories through the raw `compodoc` passthrough, but it
 *   cannot change `argTypes`, `description` or `jsDocTags`.
 * - The tsconfig's own `include`/`exclude` are not applied, so a file Compodoc would have skipped can
 *   still trigger a regeneration. Deliberate: regenerating once too often is cheap, and serving
 *   metadata that never refreshes is not.
 * - Only mtime counts. A file rewritten with identical contents looks changed; a file restored with
 *   an older timestamp looks unchanged, as does a component moved with its timestamp preserved.
 * - Directories reachable only through a symlink are not walked.
 * - The lock relies on `O_EXCL` and mtime behaving normally. On a network filesystem where they do
 *   not, two processes can both decide they hold it.
 */
import { logger } from 'storybook/internal/node-logger';

import { join, resolve } from 'node:path';

import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import { findCompodocScanRoot, isDocumentationFresh } from './documentation-freshness.ts';
import { withFileLock } from './file-lock.ts';
import { generateDocumentation } from './generate-documentation.ts';

/** Lock file name, kept beside the output so it inherits the same directory and filesystem. */
export const COMPODOC_LOCK = '.compodoc.lock';

/**
 * addon-vitest aborts its child after 30 seconds of boot, and the framework preset that calls this
 * runs inside that window. A waiter there gives up rather than failing the boot: the docgen reader
 * resolves `documentation.json` per request, so a file that lands afterwards is still picked up -
 * at the cost of an early story rendering without argTypes under a very slow cold run.
 */
const VITEST_WAIT_BUDGET_MS = 20_000;

/** Elsewhere the thing being waited on is a whole-project run, so the budget is a run's ceiling. */
const DEFAULT_WAIT_BUDGET_MS = 10 * 60 * 1000;

export type EnsureDocumentationOutcome =
  /** Already up to date; nothing ran. */
  | 'fresh'
  /** We held the lock and ran Compodoc. */
  | 'generated'
  /** Another process ran it while we waited, and the result is now on disk. */
  | 'generated-elsewhere'
  /** Another process held the lock past our budget; carry on without the file. */
  | 'timed-out'
  /** The run failed. Reported, not thrown: docgen degrades, it does not break. */
  | 'failed';

export interface EnsureDocumentationOptions {
  compodocArgs: string[];
  tsconfig: string;
  workspaceRoot: string;
  outputDir: string;
  waitBudgetMs?: number;
  timeoutMs?: number;
}

export const ensureCompodocDocumentation = async ({
  compodocArgs,
  tsconfig,
  workspaceRoot,
  outputDir,
  waitBudgetMs = process.env.VITEST ? VITEST_WAIT_BUDGET_MS : DEFAULT_WAIT_BUDGET_MS,
  timeoutMs,
}: EnsureDocumentationOptions): Promise<EnsureDocumentationOutcome> => {
  const documentationJson = join(outputDir, DOCUMENTATION_JSON);
  const scanRoot = findCompodocScanRoot(resolve(workspaceRoot, tsconfig));
  // Compodoc's own output is excluded from the scan: it lands inside the tree often enough, and it
  // is always newer than the sources it was built from, which would make it permanently stale.
  const isFresh = () => isDocumentationFresh(documentationJson, scanRoot, [outputDir]);

  if (isFresh()) {
    return 'fresh';
  }

  // Bounding the wait only protects processes that lose the race. The one that wins still has to run
  // the scan, and under Vitest that has to fit in the same boot budget, so it inherits what is left
  // of it rather than the standalone ceiling.
  const deadline = Date.now() + waitBudgetMs;
  const runTimeoutMs = () =>
    timeoutMs ?? (process.env.VITEST ? Math.max(1_000, deadline - Date.now()) : undefined);

  try {
    const outcome = await withFileLock(
      join(outputDir, COMPODOC_LOCK),
      {
        // Re-checked under the lock, so a waiter that queued behind the winner takes the winner's
        // output instead of running the same scan again.
        shouldRun: () => !isFresh(),
        run: () =>
          generateDocumentation({
            compodocArgs,
            tsconfig,
            workspaceRoot,
            outputDir,
            timeoutMs: runTimeoutMs(),
          }),
      },
      { waitBudgetMs }
    );

    if (outcome.status === 'timed-out') {
      logger.debug(
        `[storybook-angular-vite] another process is still generating ${DOCUMENTATION_JSON}; continuing without it`
      );
      return 'timed-out';
    }
    return outcome.status === 'ran' ? 'generated' : 'generated-elsewhere';
  } catch (error) {
    logger.warn(
      `[storybook-angular-vite] Compodoc generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return 'failed';
  }
};
