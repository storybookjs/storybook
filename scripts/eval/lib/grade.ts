import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GradingResult, QualityResult, TrialPaths, ChangedFile } from "../types.ts";
import { logStep, logSuccess, logError, exec } from "./utils.ts";
import { detectSetupPatterns } from "./setup-patterns.ts";
import { runGhostStories } from "./ghost-stories.ts";

/** Filter changed files to only storybook-related ones. */
export function filterStorybookFiles(changedFiles: ChangedFile[]): ChangedFile[] {
  return changedFiles.filter(
    (f) => f.path.includes(".storybook/") || /\.(stories|story)\.[tj]sx?$/.test(f.path),
  );
}

/**
 * Compute quality score.
 *
 * Weights: 40% ghost stories, 25% build, 25% typecheck, 10% performance.
 *
 * Performance is scored on a curve: ≤120s → 1.0, 600s → 0, linear between.
 */
export function computeQualityScore(opts: {
  buildSuccess: boolean;
  typeCheckErrors: number;
  ghostSuccessRate?: number;
  durationSeconds?: number;
}): QualityResult {
  const buildScore = opts.buildSuccess ? 1 : 0;
  const tcScore = Math.max(0, 1 - opts.typeCheckErrors / 20);
  const ghostScore = opts.ghostSuccessRate ?? 0;
  const d = opts.durationSeconds;
  const perfScore = d == null ? 0 : Math.max(0, Math.min(1, 1 - (d - 120) / 480));
  const score = Math.round((ghostScore * 0.4 + buildScore * 0.25 + tcScore * 0.25 + perfScore * 0.1) * 100) / 100;
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
  agentDuration?: number,
): Promise<{ grading: GradingResult; quality: QualityResult }> {
  const { repoRoot, projectPath, resultsDir, baselineCommit } = paths;

  // Changed files
  logStep("Collecting agent changes...");
  const changedFiles = await getChangedFiles(repoRoot, baselineCommit);
  const storybookFiles = filterStorybookFiles(changedFiles);
  logSuccess(`${changedFiles.length} files changed (${storybookFiles.length} storybook-related)`);

  // Setup patterns
  const setupPatterns = detectSetupPatterns(projectPath);
  if (setupPatterns.length > 0) logSuccess(`Detected patterns: ${setupPatterns.map((p) => p.label).join(", ")}`);

  // Storybook build
  logStep("Running storybook build...");
  const build = await exec("npx", ["storybook", "build", "--quiet"], {
    cwd: projectPath,
    timeout: 300_000,
    throwOnError: false,
    env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1", NODE_OPTIONS: "--max_old_space_size=4096" },
  });
  const buildSuccess = build.exitCode === 0;
  const buildOutput = build.stdout + "\n" + build.stderr;
  writeFileSync(join(resultsDir, "build-output.txt"), buildOutput);
  if (buildSuccess) {
    logSuccess("Storybook build succeeded");
  } else {
    logError(`Storybook build failed (exit ${build.exitCode})`);
  }

  // TypeScript check
  logStep("Running typecheck...");
  const tsc = await exec("npx", ["tsc", "--noEmit"], { cwd: projectPath, timeout: 120_000, throwOnError: false });
  const tscOutput = tsc.stdout + "\n" + tsc.stderr;
  writeFileSync(join(resultsDir, "typecheck-output.txt"), tscOutput);
  const typeCheckErrors = countTypeCheckErrors(tscOutput);
  if (typeCheckErrors === 0) {
    logSuccess("No TypeScript errors");
  } else {
    logError(`${typeCheckErrors} TypeScript error(s)`);
  }

  // Ghost stories (only if build passed)
  const ghostStories = buildSuccess ? await runGhostStories(projectPath, resultsDir) : undefined;

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
  await exec("git", ["add", "-A"], { cwd: repoRoot });
  const { stdout } = await exec("git", ["diff", "--cached", "--name-status", baseline], {
    cwd: repoRoot,
    throwOnError: false,
  });
  return parseChangedFiles(stdout);
}
