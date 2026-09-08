/**
 * Runs Compodoc as a child process and publishes its `documentation.json` atomically.
 *
 * Compodoc's programmatic API is not re-entrant, and its own write is not atomic, so the CLI runs
 * against a scratch directory and the finished file is renamed into place.
 */
import { executeNodeCommand } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DOCUMENTATION_JSON } from '../compodoc-config.ts';

/** Compodoc has no timeout of its own, and nothing above clocks the docgen worker either. */
const COMPODOC_TIMEOUT_MS = 10 * 60 * 1000;

/** Enough of the child's output to explain a failure without dumping a whole scan log. */
const OUTPUT_TAIL_BYTES = 4000;

const SCRATCH_PREFIX = '.compodoc-';

export interface GenerateDocumentationOptions {
  compodocArgs: string[];
  tsconfig: string;
  /** Directory Compodoc runs in; its entries' relative `file` paths are written against it. */
  workspaceRoot: string;
  /** Directory the finished {@link DOCUMENTATION_JSON} is published into. */
  outputDir: string;
  timeoutMs?: number;
}

/**
 * Locates Compodoc's CLI entry point so it can be run as `node <cli>`. The project is searched before
 * this package, so a workspace pinning its own Compodoc gets that one.
 */
export const resolveCompodocCli = (workspaceRoot: string): string | undefined => {
  const searchFrom = [pathToFileURL(join(resolve(workspaceRoot), 'noop.js')).href, import.meta.url];

  for (const from of searchFrom) {
    try {
      const packageJsonPath = createRequire(from).resolve('@compodoc/compodoc/package.json');
      const { bin } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        bin?: string | Record<string, string>;
      };
      const entry = typeof bin === 'string' ? bin : bin?.compodoc;
      if (entry) {
        return join(dirname(packageJsonPath), entry);
      }
    } catch {
      // Not resolvable from here; try the next root.
    }
  }

  return undefined;
};

const hasTsconfigArg = (args: string[]) => args.includes('-p');

/** Compodoc mishandles absolute tsconfig paths on Windows, so pass it relative to the child's cwd. */
const toChildRelativePath = (path: string, cwd: string) =>
  isAbsolute(path) ? relative(cwd, path) : path;

const runCli = async (
  cli: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<void> => {
  const result = await executeNodeCommand({
    scriptPath: cli,
    args,
    options: {
      cwd,
      // Interleaved into one stream, so the failure message reads in the order Compodoc printed it.
      all: true,
      encoding: 'utf8',
      // Failures come back as a result rather than a throw, so a timeout and a non-zero exit are
      // told apart by inspecting one object.
      reject: false,
      timeout: timeoutMs,
      // Compodoc does not shut down promptly on SIGTERM, and a hung scan would otherwise keep the
      // docgen worker waiting for it.
      killSignal: 'SIGKILL',
    },
  });

  if (!result.failed) {
    return;
  }

  const output = String(result.all ?? '')
    .trim()
    .slice(-OUTPUT_TAIL_BYTES);
  // Checked before the exit code: a killed run reports one too, which would otherwise read as an
  // ordinary failure and hide why the run really ended.
  throw new Error(
    result.timedOut
      ? `Compodoc did not finish within ${timeoutMs}ms.\n${output}`
      : `Compodoc exited with code ${result.exitCode}.\n${output}`
  );
};

/**
 * Clears scratch directories a signalled run could not clean up itself. Only ones older than a run's
 * ceiling, so a scan still in flight behind a wrongly-broken lock is left alone.
 */
const removeAbandonedScratchDirs = (outputDir: string, olderThanMs: number) => {
  const cutoff = Date.now() - olderThanMs;
  for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(SCRATCH_PREFIX)) {
      continue;
    }
    const path = join(outputDir, entry.name);
    try {
      if (statSync(path).mtimeMs < cutoff) {
        rmSync(path, { recursive: true, force: true });
      }
    } catch {
      // Best-effort tidying; one unreadable leftover is no reason to fail the run about to start.
    }
  }
};

/** Runs Compodoc once and publishes the result. Rejects if the run fails or produces no JSON. */
export const generateDocumentation = async ({
  compodocArgs,
  tsconfig,
  workspaceRoot,
  outputDir,
  timeoutMs = COMPODOC_TIMEOUT_MS,
}: GenerateDocumentationOptions): Promise<void> => {
  const cli = resolveCompodocCli(workspaceRoot);
  if (!cli) {
    throw new Error(
      '@compodoc/compodoc could not be resolved. Install it as a devDependency, or set framework.options.compodoc to false to turn Angular docgen off.'
    );
  }

  mkdirSync(outputDir, { recursive: true });
  removeAbandonedScratchDirs(outputDir, timeoutMs);
  // Scratch directory inside the output directory, so publishing below is a same-filesystem rename.
  const scratchDir = mkdtempSync(join(outputDir, SCRATCH_PREFIX));
  const startedAt = Date.now();

  logger.info('[storybook-angular-vite] Generating Angular documentation with Compodoc...');

  try {
    await runCli(
      cli,
      [
        ...(hasTsconfigArg(compodocArgs)
          ? []
          : ['-p', toChildRelativePath(tsconfig, workspaceRoot)]),
        ...compodocArgs,
        // Last occurrence wins on Compodoc's command line, so this overrides any `-d`/`--output` the
        // user configured. Their directory is where the finished file lands, not where it is built.
        '-d',
        scratchDir,
      ],
      workspaceRoot,
      timeoutMs
    );

    const produced = join(scratchDir, DOCUMENTATION_JSON);
    if (!existsSync(produced)) {
      throw new Error(
        `Compodoc finished without writing ${DOCUMENTATION_JSON}. Check that its arguments still export JSON: ${compodocArgs.join(' ')}`
      );
    }

    renameSync(produced, join(outputDir, DOCUMENTATION_JSON));
    logger.debug(
      `[storybook-angular-vite] generated ${DOCUMENTATION_JSON} in ${Date.now() - startedAt}ms`
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
};
