import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GradingResult, GhostStoriesResult, QualityResult, QualityWeights, TrialPaths, ChangedFile, Logger } from "../types.ts";
import { DEFAULT_QUALITY_WEIGHTS } from "../types.ts";
import { x } from "tinyexec";
import { detectSetupPatterns } from "./setup-patterns.ts";
import { getComponentCandidates, runGhostStories } from "../../../code/core/src/core-server/index.ts";

/** Filter changed files to only storybook-related ones. */
export function filterStorybookFiles(changedFiles: ChangedFile[]): ChangedFile[] {
  return changedFiles.filter(
    (f) => f.path.includes(".storybook/") || /\.(stories|story)\.[tj]sx?$/.test(f.path),
  );
}

/**
 * Compute quality score with configurable weights.
 *
 * Default weights: 40% ghost stories, 25% build, 25% typecheck, 10% performance.
 *
 * Performance is scored on a curve: <=120s -> 1.0, 600s -> 0, linear between.
 */
export function computeQualityScore(
  opts: {
    buildSuccess: boolean;
    typeCheckErrors: number;
    ghostSuccessRate?: number;
    durationSeconds?: number;
  },
  weights: QualityWeights = DEFAULT_QUALITY_WEIGHTS,
): QualityResult {
  const buildScore = opts.buildSuccess ? 1 : 0;
  const tcScore = Math.max(0, 1 - opts.typeCheckErrors / 20);
  const ghostScore = opts.ghostSuccessRate ?? 0;
  const d = opts.durationSeconds;
  const perfScore = d == null ? 0 : Math.max(0, Math.min(1, 1 - (d - 120) / 480));
  const score =
    Math.round(
      (ghostScore * weights.ghostStories +
        buildScore * weights.build +
        tcScore * weights.typecheck +
        perfScore * weights.performance) *
        100,
    ) / 100;
  return {
    score,
    breakdown: {
      build: buildScore,
      typecheck: Math.round(tcScore * 100) / 100,
      ghostStories: Math.round(ghostScore * 100) / 100,
      performance: Math.round(perfScore * 100) / 100,
    },
  };
}

/** Count TypeScript errors from tsc output. */
export function countTypeCheckErrors(tscOutput: string): number {
  return (tscOutput.match(/error TS\d+/g) || []).length;
}

/** Parse git diff --name-status output into ChangedFile objects. */
export function parseChangedFiles(gitOutput: string): ChangedFile[] {
  return gitOutput
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split("\t");
      return { path: parts.join("\t"), status: (status?.charAt(0) || "M") as ChangedFile["status"] };
    });
}

export async function grade(
  paths: TrialPaths,
  logger: Logger,
  agentDuration?: number,
): Promise<{ grading: GradingResult; quality: QualityResult }> {
  const { repoRoot, projectPath, resultsDir, baselineCommit } = paths;

  // Changed files
  logger.logStep("Collecting agent changes...");
  const changedFiles = await getChangedFiles(repoRoot, baselineCommit);
  const storybookFiles = filterStorybookFiles(changedFiles);
  logger.logSuccess(`${changedFiles.length} files changed (${storybookFiles.length} storybook-related)`);

  // Setup patterns
  const setupPatterns = await detectSetupPatterns(projectPath);
  if (setupPatterns.length > 0) logger.logSuccess(`Detected patterns: ${setupPatterns.map((p) => p.label).join(", ")}`);

  // Storybook build + TypeScript check in parallel
  logger.logStep("Running storybook build + typecheck...");
  const [build, tsc] = await Promise.all([
    x("npx", ["storybook", "build", "--quiet"], {
      throwOnError: false,
      timeout: 300_000,
      nodeOptions: {
        cwd: projectPath,
        env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1", NODE_OPTIONS: "--max_old_space_size=4096" },
      },
    }),
    x("npx", ["tsc", "--noEmit"], { throwOnError: false, timeout: 120_000, nodeOptions: { cwd: projectPath } }),
  ]);

  const buildSuccess = build.exitCode === 0;
  const buildOutput = build.stdout + "\n" + build.stderr;
  await writeFile(join(resultsDir, "build-output.txt"), buildOutput);
  if (buildSuccess) {
    logger.logSuccess("Storybook build succeeded");
  } else {
    logger.logError(`Storybook build failed (exit ${build.exitCode})`);
  }

  const tscOutput = tsc.stdout + "\n" + tsc.stderr;
  await writeFile(join(resultsDir, "typecheck-output.txt"), tscOutput);
  const typeCheckErrors = countTypeCheckErrors(tscOutput);
  if (typeCheckErrors === 0) {
    logger.logSuccess("No TypeScript errors");
  } else {
    logger.logError(`${typeCheckErrors} TypeScript error(s)`);
  }

  // Ghost stories (only if build passed)
  const ghostStories = buildSuccess ? await gradeGhostStories(projectPath, logger) : undefined;

  const grading: GradingResult = {
    buildSuccess,
    buildError: buildSuccess ? undefined : buildOutput.slice(-2000),
    typeCheckErrors,
    typeCheckOutput: typeCheckErrors > 0 ? tscOutput.slice(-2000) : undefined,
    changedFiles,
    storybookFiles,
    setupPatterns,
    ghostStories,
  };

  const quality = computeQualityScore({
    buildSuccess,
    typeCheckErrors,
    ghostSuccessRate: ghostStories?.successRate,
    durationSeconds: agentDuration,
  });

  return { grading, quality };
}

async function getChangedFiles(repoRoot: string, baseline: string): Promise<ChangedFile[]> {
  // Stage all files so `git diff --cached` picks up new files the agent created.
  // Safe: this runs on an ephemeral trial copy, not the real repo.
  await x("git", ["add", "-A"], { nodeOptions: { cwd: repoRoot } });
  const { stdout } = await x("git", ["diff", "--cached", "--name-status", baseline], {
    throwOnError: false,
    nodeOptions: { cwd: repoRoot },
  });
  return parseChangedFiles(stdout);
}

async function gradeGhostStories(projectPath: string, logger: Logger): Promise<GhostStoriesResult | undefined> {
  logger.logStep("Running ghost stories...");

  const { candidates, error } = await getComponentCandidates({ sampleSize: 20, cwd: projectPath });
  if (error || candidates.length === 0) {
    logger.logError(error ?? "No candidate components found");
    return undefined;
  }
  logger.logStep(`Found ${candidates.length} candidate component(s)`);

  const result = await runGhostStories(candidates, { cwd: projectPath });
  const { total, passed, successRate } = result.summary ?? { total: 0, passed: 0, successRate: 0 };

  if (result.runError) {
    logger.logError(`Ghost stories: ${result.runError}`);
  } else if (total > 0) {
    logger.logSuccess(`Ghost stories: ${passed}/${total} passed (${Math.round(successRate * 100)}%)`);
  }

  return { candidateCount: candidates.length, total, passed, successRate };
}
