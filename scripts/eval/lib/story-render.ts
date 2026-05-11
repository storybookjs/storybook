import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'pathe';
import { x } from 'tinyexec';
import { parseVitestResults } from '../../../code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts';
import type { FileChange } from './grade.ts';
import { detectPackageManager, resolveInstallRoot } from './package-manager.ts';
import type { Logger } from './utils.ts';

const STORY_FILE_PATTERN = /\.(stories|story)\.[tj]sx?$/;

export interface StoryRenderGrade {
  total: number;
  passed: number;
  storyFiles: number;
  cssCheck: 'pass' | 'fail' | 'not-run';
}

export interface StoryRenderRunResult {
  attempted: boolean;
  success: boolean;
  outputPath?: string;
  reportPath?: string;
  runError?: string;
  summary?: StoryRenderGrade;
}

interface FileSnapshot {
  path: string;
  content: Buffer | null;
}

export function getGeneratedStoryFiles(
  repoRoot: string,
  projectPath: string,
  fileChanges: FileChange[]
): string[] {
  return getChangedStoryFiles(repoRoot, fileChanges).filter((storyFile) => {
    const relativePath = relative(projectPath, storyFile);
    return relativePath !== '' && !relativePath.startsWith('..');
  });
}

export function getChangedStoryFiles(repoRoot: string, fileChanges: FileChange[]): string[] {
  return fileChanges
    .filter((change) => change.gitStatus !== 'D' && STORY_FILE_PATTERN.test(change.path))
    .map((change) => resolve(repoRoot, change.path));
}

export function getPreviewEnvironmentFiles(fileChanges: FileChange[]): string[] {
  return fileChanges
    .flatMap((change) => [change.path, change.previousPath].filter(Boolean) as string[])
    .filter(isPreviewEnvironmentPath)
    .filter((path, index, values) => values.indexOf(path) === index)
    .sort();
}

/**
 * Each benchmark repo must define a `vitest:storybook` script in its package.json
 * that knows how to run the storybook vitest project for that repo.
 * The grading harness appends `--reporter=json --outputFile=... <storyFiles>`.
 */
export async function runStoryRenderPass(opts: {
  projectPath: string;
  resultsDir: string;
  storyFiles: string[];
  outputBaseName: string;
  label?: string;
  logger: Logger;
}): Promise<StoryRenderRunResult> {
  const tag = opts.label ?? 'story-render';
  const runnableStoryFiles = opts.storyFiles.filter((storyFile) => {
    const rel = relative(opts.projectPath, storyFile);
    return rel !== '' && !rel.startsWith('..');
  });

  if (runnableStoryFiles.length === 0) {
    opts.logger.logStep(`No generated story files found for ${tag}.`);
    return {
      attempted: false,
      success: true,
      summary: {
        total: 0,
        passed: 0,
        storyFiles: 0,
        cssCheck: 'not-run' as const,
      },
    };
  }

  const reportPath = join(opts.resultsDir, `${opts.outputBaseName}-report.json`);
  const outputPath = join(opts.resultsDir, `${opts.outputBaseName}-output.txt`);

  opts.logger.logStep(`Running ${tag} for ${runnableStoryFiles.length} story file(s)...`);

  const pm = detectPackageManager(resolveInstallRoot(opts.projectPath));
  const [runCmd, ...runArgs] = getScriptRunCommand(pm);

  const timeoutMs = STORY_RENDER_TIMEOUT_MS;
  let result: { exitCode: number | null; stdout: string; stderr: string };
  let timedOut = false;
  try {
    result = await x(
      runCmd,
      [...runArgs, '--reporter=json', `--outputFile=${reportPath}`, ...runnableStoryFiles],
      {
        throwOnError: false,
        timeout: timeoutMs,
        nodeOptions: {
          cwd: opts.projectPath,
          env: {
            ...process.env,
            STORYBOOK_DISABLE_TELEMETRY: '1',
          },
        },
      }
    );
  } catch (error) {
    if (isAbortTimeoutError(error)) {
      timedOut = true;
      result = { exitCode: null, stdout: '', stderr: `Timed out after ${timeoutMs / 1000}s` };
    } else {
      throw error;
    }
  }

  const output = `${result.stdout}\n${result.stderr}`.trim();
  await writeFile(outputPath, output);

  const summary = existsSync(reportPath)
    ? await readStoryRenderSummary(reportPath, runnableStoryFiles.length)
    : undefined;

  const success = !timedOut && result.exitCode === 0;
  if (success) {
    opts.logger.logSuccess(`${tag}: passed`);
  } else if (timedOut) {
    opts.logger.logError(`${tag}: timed out after ${timeoutMs / 1000}s`);
  } else {
    const rate = summary ? `${summary.passed}/${summary.total} passed` : `exit ${result.exitCode}`;
    opts.logger.logError(`${tag}: ${rate}`);
  }

  return {
    attempted: true,
    success,
    outputPath,
    reportPath,
    runError: timedOut
      ? `Story-render run timed out after ${timeoutMs / 1000}s`
      : summary
        ? undefined
        : output || 'Story-render report not found',
    summary,
  };
}

const STORY_RENDER_TIMEOUT_MS = 600_000;

function isAbortTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ('code' in error && (error as { code?: string }).code === 'ABORT_ERR') return true;
  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof Error && cause.name === 'TimeoutError';
}

/** Build the full command tokens for `<pm> run vitest:storybook [--] <extra args>`. */
export function getScriptRunCommand(pm: string): string[] {
  switch (pm) {
    case 'pnpm':
      return ['pnpm', 'run', 'vitest:storybook'];
    case 'yarn':
      return ['yarn', 'vitest:storybook'];
    case 'bun':
      return ['bun', 'run', 'vitest:storybook'];
    default:
      return ['npm', 'run', 'vitest:storybook', '--'];
  }
}

export async function withBaselinePreviewEnvironment<T>(opts: {
  repoRoot: string;
  baselineCommit: string;
  fileChanges: FileChange[];
  fn: () => Promise<T>;
}): Promise<T> {
  const previewFiles = getPreviewEnvironmentFiles(opts.fileChanges);
  if (previewFiles.length === 0) {
    return opts.fn();
  }

  const snapshots = await snapshotFiles(opts.repoRoot, previewFiles);

  try {
    await restoreFilesFromCommit(opts.repoRoot, opts.baselineCommit, previewFiles);
    return await opts.fn();
  } finally {
    await restoreSnapshots(opts.repoRoot, snapshots);
  }
}

async function readStoryRenderSummary(reportPath: string, storyFiles: number) {
  try {
    const rawReport = JSON.parse(await readFile(reportPath, 'utf8'));
    const parsed = parseVitestResults(rawReport).summary;

    if (!parsed) {
      return undefined;
    }

    return {
      total: parsed.runTotal,
      passed: parsed.runPassed,
      storyFiles,
      cssCheck: parsed.runCssCheck,
    } satisfies StoryRenderGrade;
  } catch {
    return undefined;
  }
}

async function snapshotFiles(repoRoot: string, paths: string[]): Promise<FileSnapshot[]> {
  return Promise.all(
    paths.map(async (path) => {
      const absolutePath = join(repoRoot, path);
      return {
        path,
        content: existsSync(absolutePath) ? await readFile(absolutePath) : null,
      };
    })
  );
}

async function restoreFilesFromCommit(repoRoot: string, baselineCommit: string, paths: string[]) {
  await Promise.all(
    paths.map(async (path) => {
      const absolutePath = join(repoRoot, path);
      const gitObject = `${baselineCommit}:${path}`;
      const result = await x('git', ['show', gitObject], {
        throwOnError: false,
        nodeOptions: { cwd: repoRoot },
      });

      if (result.exitCode === 0) {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, result.stdout);
        return;
      }

      await rm(absolutePath, { force: true });
    })
  );
}

async function restoreSnapshots(repoRoot: string, snapshots: FileSnapshot[]) {
  await Promise.all(
    snapshots.map(async ({ path, content }) => {
      const absolutePath = join(repoRoot, path);
      if (content == null) {
        await rm(absolutePath, { force: true });
        return;
      }

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content);
    })
  );
}

function isPreviewEnvironmentPath(path: string) {
  const normalized = path.replace(/\\/g, '/');
  return /(^|\/)\.storybook\/preview\.[^/]+$/.test(normalized);
}
