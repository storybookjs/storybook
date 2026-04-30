import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { x } from 'tinyexec';
import { getComponentCandidates } from '../../../code/core/src/core-server/utils/ghost-stories/get-candidates.ts';
import { parseVitestResults } from '../../../code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts';
import { detectPackageManager, resolveInstallRoot } from './package-manager.ts';
import { capitalizeFirst, type Logger } from './utils.ts';
import type { TrialWorkspace } from './prepare-trial.ts';
import {
  getGeneratedStoryFiles,
  getScriptRunCommand,
  runStoryRenderPass,
  type StoryRenderGrade,
  withBaselinePreviewEnvironment,
} from './story-render.ts';

/** Git `--name-status` codes: A=added, M=modified, D=deleted, R=renamed. */
export type GitDiffStatus = 'A' | 'M' | 'D' | 'R';

export interface FileChange {
  path: string;
  gitStatus: GitDiffStatus;
  /** For renames, the original path before the move. */
  previousPath?: string;
}

export interface GhostStoryGrade {
  candidateCount: number;
  total: number;
  passed: number;
  successRate: number;
}

export interface QualityScore {
  score: number;
  breakdown: {
    beforeRate: number;
    afterRate: number;
    gain: number;
  };
}

export interface Grade {
  buildSuccess: boolean;
  buildError?: string;
  typeCheckErrors: number;
  typeCheckOutput?: string;
  fileChanges: FileChange[];
  storybookChanges: FileChange[];
  baselineGhostStories?: GhostStoryGrade;
  ghostStories?: GhostStoryGrade;
  baselinePreviewStories?: StoryRenderGrade;
  storyRender?: StoryRenderGrade;
}

/** Filter file changes to only storybook-related ones. */
export function filterStorybookFiles(fileChanges: FileChange[]): FileChange[] {
  const isStorybookPath = (path?: string) =>
    path != null && (path.includes('.storybook/') || /\.(stories|story)\.[tj]sx?$/.test(path));

  return fileChanges.filter((f) => isStorybookPath(f.path) || isStorybookPath(f.previousPath));
}

/**
 * Compute the eval score from normalized preview gain on generated stories.
 *
 * Build, typecheck, runtime, and ghost stories are still recorded in the eval output,
 * but they no longer contribute to the score itself.
 *
 * When the baseline is already at 100% story coverage, the score is **0** (no remaining gap).
 */
export function computeQualityScore(opts: {
  baselinePreviewStories?: Pick<StoryRenderGrade, 'passed' | 'total'>;
  storyRender?: Pick<StoryRenderGrade, 'passed' | 'total'>;
}): QualityScore {
  const beforeRate = getStoryRenderRate(opts.baselinePreviewStories);
  const afterRate = getStoryRenderRate(opts.storyRender);
  const gain = computeNormalizedGain(beforeRate, afterRate);

  return {
    score: gain,
    breakdown: {
      beforeRate: beforeRate ?? 0,
      afterRate: afterRate ?? 0,
      gain,
    },
  };
}

/** Count TypeScript errors from tsc output. */
export function countTypeCheckErrors(tscOutput: string): number {
  return (tscOutput.match(/error TS\d+/g) || []).length;
}

/** Parse git diff --name-status output into FileChange objects. */
export function parseChangedFiles(gitOutput: string): FileChange[] {
  return gitOutput
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split('\t');
      const gitStatus = parseGitDiffStatus(status);

      if (gitStatus === 'R' && parts.length >= 2) {
        const [previousPath, path] = parts;
        return { path, previousPath, gitStatus };
      }

      return { path: parts.join('\t'), gitStatus };
    });
}

export async function grade(
  workspace: TrialWorkspace,
  logger: Logger,
  baselineGhostStories?: GhostStoryGrade
): Promise<{ grade: Grade; score: QualityScore }> {
  const { repoRoot, projectPath, resultsDir, baselineCommit } = workspace;

  // Changed files
  logger.logStep('Collecting agent changes...');
  const fileChanges = await getChangedFiles(repoRoot, baselineCommit);
  const storybookChanges = filterStorybookFiles(fileChanges);
  logger.logSuccess(
    `${fileChanges.length} files changed (${storybookChanges.length} storybook-related)`
  );

  // Storybook build + TypeScript check in parallel
  logger.logStep('Running storybook build + typecheck...');
  const [build, tsc] = await Promise.all([
    x('npx', ['storybook', 'build', '--quiet'], {
      throwOnError: false,
      timeout: 300_000,
      nodeOptions: {
        cwd: projectPath,
        env: {
          ...process.env,
          STORYBOOK_DISABLE_TELEMETRY: '1',
          NODE_OPTIONS: '--max_old_space_size=4096',
        },
      },
    }),
    x('npx', ['tsc', '--noEmit'], {
      throwOnError: false,
      timeout: 120_000,
      nodeOptions: { cwd: projectPath },
    }),
  ]);

  const buildSuccess = build.exitCode === 0;
  const buildOutput = build.stdout + '\n' + build.stderr;
  await writeFile(join(resultsDir, 'build-output.txt'), buildOutput);
  if (buildSuccess) {
    logger.logSuccess('Storybook build succeeded');
  } else {
    logger.logError(`Storybook build failed (exit ${build.exitCode})`);
  }

  const tscOutput = tsc.stdout + '\n' + tsc.stderr;
  await writeFile(join(resultsDir, 'typecheck-output.txt'), tscOutput);
  const typeCheckErrors = countTypeCheckErrors(tscOutput);
  if (typeCheckErrors === 0) {
    logger.logSuccess('No TypeScript errors');
  } else {
    logger.logError(`${typeCheckErrors} TypeScript error(s)`);
  }

  const generatedStoryFiles = getGeneratedStoryFiles(repoRoot, projectPath, fileChanges);

  const ghostStories = await collectGhostStoriesGrade(projectPath, logger);

  const storyRenderRun = await runStoryRenderPass({
    projectPath,
    resultsDir,
    storyFiles: generatedStoryFiles,
    outputBaseName: 'story-render',
    label: 'story tests',
    logger,
  });

  const cssCheck = storyRenderRun.summary?.cssCheck ?? 'not-run';
  if (cssCheck === 'pass') {
    logger.logSuccess('CssCheck story passed');
  } else if (cssCheck === 'fail') {
    logger.logError('CssCheck story failed');
  } else {
    logger.logError('CssCheck story missing or not run');
  }

  const baselinePreviewRun = await withBaselinePreviewEnvironment({
    repoRoot,
    baselineCommit,
    fileChanges,
    fn: () =>
      runStoryRenderPass({
        projectPath,
        resultsDir,
        storyFiles: generatedStoryFiles,
        outputBaseName: 'baseline-story-render',
        label: 'baseline story tests (original preview)',
        logger,
      }),
  });

  const trialGrade: Grade = {
    buildSuccess,
    buildError: buildSuccess ? undefined : truncateEnd(buildOutput, 2000),
    typeCheckErrors,
    typeCheckOutput: typeCheckErrors > 0 ? truncateEnd(tscOutput, 2000) : undefined,
    fileChanges,
    storybookChanges,
    baselineGhostStories,
    ghostStories,
    baselinePreviewStories: baselinePreviewRun.summary,
    storyRender: storyRenderRun.summary,
  };

  const score = computeQualityScore({
    baselinePreviewStories: baselinePreviewRun.summary,
    storyRender: storyRenderRun.summary,
  });

  return { grade: trialGrade, score };
}

function getStoryRenderRate(storyRender?: Pick<StoryRenderGrade, 'passed' | 'total'>) {
  if (!storyRender || storyRender.total <= 0) {
    return undefined;
  }

  const rate = storyRender.passed / storyRender.total;
  return Number.isNaN(rate) ? undefined : rate;
}

/** Truncate text to approximately maxChars, snapping to a line boundary. */
function truncateEnd(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(-maxChars);
  const firstNewline = truncated.indexOf('\n');
  return firstNewline >= 0 ? truncated.slice(firstNewline + 1) : truncated;
}

function parseGitDiffStatus(rawStatus?: string): GitDiffStatus {
  const firstChar = rawStatus?.charAt(0);
  return firstChar === 'A' || firstChar === 'M' || firstChar === 'D' || firstChar === 'R'
    ? firstChar
    : 'M';
}

async function getChangedFiles(repoRoot: string, baseline: string): Promise<FileChange[]> {
  // Stage all files so `git diff --cached` picks up new files the agent created.
  // Safe: this runs on an ephemeral trial copy, not the real repo.
  await x('git', ['add', '-A'], { nodeOptions: { cwd: repoRoot } });
  const { stdout } = await x('git', ['diff', '--cached', '--name-status', baseline], {
    throwOnError: false,
    nodeOptions: { cwd: repoRoot },
  });
  return parseChangedFiles(stdout);
}

export async function collectGhostStoriesGrade(
  projectPath: string,
  logger: Logger,
  label = 'ghost stories'
): Promise<GhostStoryGrade | undefined> {
  logger.logStep(`Running ${label}...`);

  try {
    const { candidates } = await getComponentCandidates({ sampleSize: 20, cwd: projectPath });
    if (candidates.length === 0) {
      logger.logError(`No candidate components found for ${label}`);
      return undefined;
    }
    logger.logStep(`Found ${candidates.length} candidate component(s) for ${label}`);

    const pm = detectPackageManager(resolveInstallRoot(projectPath));
    const [runCmd, ...runArgs] = getScriptRunCommand(pm);
    const outputFile = join(projectPath, `ghost-stories-report-${Date.now()}.json`);

    const result = await x(
      runCmd,
      [
        ...runArgs,
        '--reporter=json',
        '--testTimeout=1000',
        `--outputFile=${outputFile}`,
        ...candidates,
      ],
      {
        throwOnError: false,
        timeout: 300_000,
        nodeOptions: {
          cwd: projectPath,
          env: {
            ...process.env,
            STORYBOOK_DISABLE_TELEMETRY: '1',
            STORYBOOK_COMPONENT_PATHS: candidates.join(';'),
          },
        },
      }
    );

    const stderr = result.stderr.toLowerCase();
    if (result.exitCode !== 0 && !existsSync(outputFile)) {
      const runError = stderr.includes('no tests found')
        ? 'No tests found'
        : stderr.includes('browsertype.launch')
          ? 'Playwright is not installed'
          : stderr.includes('startup error')
            ? 'Startup Error'
            : `Exit ${result.exitCode}`;
      logger.logError(`${capitalizeFirst(label)}: ${runError}`);
      return undefined;
    }

    if (!existsSync(outputFile)) {
      logger.logError(`${capitalizeFirst(label)}: JSON report not found`);
      return undefined;
    }

    const rawReport = JSON.parse(await readFile(outputFile, 'utf8'));
    const parsed = parseVitestResults(rawReport);
    const emptyRenders = parsed.summary?.passedButEmptyRender ?? 0;

    // Suite-level: each file either loaded and rendered or it didn't.
    const total: number = rawReport.numTotalTestSuites ?? 0;
    const passed = (rawReport.numPassedTestSuites ?? 0) - emptyRenders;
    const successRate = total > 0 ? passed / total : 0;

    if (total === 0) {
      logger.logError(`${capitalizeFirst(label)}: No tests found`);
      return undefined;
    }

    logger.logSuccess(
      `${capitalizeFirst(label)}: ${passed}/${total} passed (${Math.round(successRate * 100)}%)${emptyRenders > 0 ? ` (${emptyRenders} empty renders excluded)` : ''}`
    );

    return {
      candidateCount: candidates.length,
      total,
      passed,
      successRate,
    };
  } catch (error) {
    logger.logError(
      `${capitalizeFirst(label)}: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

/**
 * Normalized preview gain: fraction of the remaining gap to 100% pass rate that this run closed.
 *
 * - Missing rates → 0
 * - Baseline already at 100% → 0 (no remaining improvement; avoids scoring a no-op as full gain)
 * - Otherwise → (after − before) / (1 − before), clamped to [0, 1]. When `before` is 0, this is
 *   just `after` (all improvement from zero).
 */
function computeNormalizedGain(beforeRate?: number, afterRate?: number) {
  if (beforeRate == null || afterRate == null) {
    return 0;
  }

  if (beforeRate >= 1) {
    return 0;
  }

  const gain = (afterRate - beforeRate) / (1 - beforeRate);
  return Math.max(0, Math.min(1, Number.isNaN(gain) ? 0 : gain));
}
