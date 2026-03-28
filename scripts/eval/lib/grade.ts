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

/** Compute quality score: 70% build + 30% typecheck. */
export function computeQualityScore(buildSuccess: boolean, typeCheckErrors: number): QualityResult {
  const buildScore = buildSuccess ? 1 : 0;
  const tcScore = Math.max(0, 1 - typeCheckErrors / 20);
  const score = Math.round((buildScore * 0.7 + tcScore * 0.3) * 100) / 100;
  return { score, breakdown: { build: buildScore, typecheck: Math.round(tcScore * 100) / 100 } };
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

export async function grade(paths: TrialPaths): Promise<{ grading: GradingResult; quality: QualityResult }> {
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
  writeFileSync(join(resultsDir, "build-output.txt"), build.stdout + "\n" + build.stderr);
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
    buildError: buildSuccess ? undefined : (build.stdout + "\n" + build.stderr).slice(-2000),
    typeCheckErrors,
    typeCheckOutput: typeCheckErrors > 0 ? tscOutput.slice(-2000) : undefined,
    changedFiles,
    storybookFiles,
    setupPatterns,
    ghostStories,
  };

  const quality = computeQualityScore(buildSuccess, typeCheckErrors);

  return { grading, quality };
}

async function getChangedFiles(repoRoot: string, baseline: string): Promise<ChangedFile[]> {
  await exec("git", ["add", "-A"], { cwd: repoRoot });
  const { stdout } = await exec("git", ["diff", "--cached", "--name-status", baseline], {
    cwd: repoRoot,
    throwOnError: false,
  });
  return parseChangedFiles(stdout);
}
