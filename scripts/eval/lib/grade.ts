import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { x } from 'tinyexec';
import { getComponentCandidates } from '../../../code/core/src/core-server/utils/ghost-stories/get-candidates.ts';
import { runStoryTests } from '../../../code/core/src/core-server/utils/ghost-stories/run-story-tests.ts';
import type { Logger } from './utils.ts';
import type { TrialWorkspace } from './prepare-trial.ts';
import {
  getGeneratedStoryFiles,
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
    logger,
  });

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

    const result = await runStoryTests(candidates, { cwd: projectPath });

    if (result.runError) {
      logger.logError(`${capitalize(label)}: ${result.runError}`);
      return undefined;
    }

    const summary = 'summary' in result ? result.summary : undefined;

    if (summary && summary.total > 0) {
      const realPassed = summary.passed - summary.passedButEmptyRender;
      logger.logSuccess(
        `${capitalize(label)}: ${realPassed}/${summary.total} passed (${Math.round(summary.successRateWithoutEmptyRender * 100)}%)${summary.passedButEmptyRender > 0 ? ` (${summary.passedButEmptyRender} empty renders excluded)` : ''}`
      );
    }

    return {
      candidateCount: candidates.length,
      total: summary?.total ?? 0,
      passed: (summary?.passed ?? 0) - (summary?.passedButEmptyRender ?? 0),
      successRate: summary?.successRateWithoutEmptyRender ?? 0,
    };
  } catch (error) {
    logger.logError(
      `${capitalize(label)}: ${error instanceof Error ? error.message : String(error)}`
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
