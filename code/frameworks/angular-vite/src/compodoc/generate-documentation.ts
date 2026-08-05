/**
 * Runs Compodoc as a child process and publishes its `documentation.json` atomically.
 *
 * Compodoc's programmatic API is not an option for repeated on-demand runs: `generate()` hands back
 * a module-scoped singleton promise created at import, it installs `process.exit` handlers on the
 * host process, and it mutates a global configuration object. The CLI is the only re-entrant entry
 * point it has.
 *
 * Compodoc's own write is not atomic either - fs-extra `outputFile` with the default `'w'` flag, so
 * the file exists at length 0 and grows - and a reader that parses it mid-write gets a syntax error.
 * Excluding concurrent writers does not fix that, so the run is pointed at a scratch directory
 * beside the real one and the finished file is renamed into place.
 */
import { logger } from 'storybook/internal/node-logger';

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  utimesSync,
} from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import { resolveCompodocCli } from './compodoc-cli.ts';

/**
 * Compodoc has no timeout of its own, and the docgen worker awaits this during provider
 * construction, which core does not clock either. Without this a hung run hangs docgen forever.
 */
export const COMPODOC_TIMEOUT_MS = 10 * 60 * 1000;

/** Enough of the child's output to explain a failure without dumping a whole scan log. */
const OUTPUT_TAIL_BYTES = 4000;

export interface GenerateDocumentationOptions {
  compodocArgs: string[];
  tsconfig: string;
  /** Directory Compodoc runs in; its entries' relative `file` paths are written against it. */
  workspaceRoot: string;
  /** Directory the finished {@link DOCUMENTATION_JSON} is published into. */
  outputDir: string;
  timeoutMs?: number;
}

const hasTsconfigArg = (args: string[]) => args.includes('-p');

/**
 * Compodoc mishandles absolute tsconfig paths on Windows, so the path is passed relative to the
 * directory the child runs in.
 */
const toChildRelativePath = (path: string, cwd: string) =>
  isAbsolute(path) ? relative(cwd, path) : path;

const runCli = (cli: string, args: string[], cwd: string, timeoutMs: number): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    // One decoder per stream, so a multi-byte character split across two chunks is not turned into
    // replacement characters in the failure message.
    const collectFrom = (decoder: StringDecoder) => (chunk: Buffer) => {
      output = `${output}${decoder.write(chunk)}`.slice(-OUTPUT_TAIL_BYTES);
    };
    child.stdout?.on('data', collectFrom(new StringDecoder('utf8')));
    child.stderr?.on('data', collectFrom(new StringDecoder('utf8')));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      // Checked before the exit code: a killed child closes with a null code, which would otherwise
      // read as an ordinary failure and hide why the run really ended.
      if (timedOut) {
        reject(new Error(`Compodoc did not finish within ${timeoutMs}ms.\n${output.trim()}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Compodoc exited with code ${code}.\n${output.trim()}`));
        return;
      }
      resolvePromise();
    });
  });

const SCRATCH_PREFIX = '.compodoc-';

/** Clears scratch directories a signalled run could not clean up itself. */
const removeAbandonedScratchDirs = (outputDir: string) => {
  try {
    for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(SCRATCH_PREFIX)) {
        rmSync(join(outputDir, entry.name), { recursive: true, force: true });
      }
    }
  } catch {
    // Best-effort tidying; never a reason to fail the run that is about to start.
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
  // A run killed by a signal never reaches the cleanup below, so sweep anything an earlier one left
  // behind rather than letting scratch directories pile up in the user's project.
  removeAbandonedScratchDirs(outputDir);
  // Scratch directory inside the output directory, so publishing below is a same-filesystem rename.
  const scratchDir = mkdtempSync(join(outputDir, '.compodoc-'));
  const startedAt = Date.now();

  // A whole-project scan takes seconds to minutes with nothing else on screen, and it blocks both
  // the dev server's cold start and the docgen worker's first answer.
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

    const published = join(outputDir, DOCUMENTATION_JSON);
    renameSync(produced, published);
    // Stamped with the moment the scan started, not the moment it finished. Compodoc read the
    // sources at the start, so a file edited while the scan was running is genuinely newer than this
    // output - and dating the output later would hide that edit until something else changed.
    const scanStart = new Date(startedAt);
    utimesSync(published, scanStart, scanStart);
    logger.debug(
      `[storybook-angular-vite] generated ${DOCUMENTATION_JSON} in ${Date.now() - startedAt}ms`
    );
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
};
