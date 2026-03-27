import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GradingResult, QualityResult, TrialPaths, ChangedFile } from "../types";
import { logStep, logSuccess, logError, exec, cleanEnv } from "./utils";
import { detectSetupPatterns } from "./setup-patterns";
import { runGhostStories } from "./ghost-stories";

export async function grade(paths: TrialPaths): Promise<{ grading: GradingResult; quality: QualityResult }> {
  const { repoRoot, projectPath, resultsDir, baselineCommit } = paths;
  const env = cleanEnv();

  // Changed files
  logStep("Collecting agent changes...");
  const changedFiles = await getChangedFiles(repoRoot, baselineCommit);
  const storybookFiles = changedFiles.filter(
    (f) => f.path.includes(".storybook/") || /\.(stories|story)\.[tj]sx?$/.test(f.path),
  );
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
    env: { ...env, STORYBOOK_DISABLE_TELEMETRY: "1", NODE_OPTIONS: "--max_old_space_size=4096" },
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
  const tsc = await exec("npx", ["tsc", "--noEmit"], { cwd: projectPath, timeout: 120_000, throwOnError: false, env });
  const tscOutput = tsc.stdout + "\n" + tsc.stderr;
  writeFileSync(join(resultsDir, "typecheck-output.txt"), tscOutput);
  const typeCheckErrors = (tscOutput.match(/error TS\d+/g) || []).length;
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

  // Quality = 70% build + 30% typecheck
  const buildScore = buildSuccess ? 1 : 0;
  const tcScore = Math.max(0, 1 - typeCheckErrors / 20);
  const score = Math.round((buildScore * 0.7 + tcScore * 0.3) * 100) / 100;

  return {
    grading,
    quality: { score, breakdown: { build: buildScore, typecheck: Math.round(tcScore * 100) / 100 } },
  };
}

async function getChangedFiles(repoRoot: string, baseline: string): Promise<ChangedFile[]> {
  await exec("git", ["add", "-A"], { cwd: repoRoot });
  const { stdout } = await exec("git", ["diff", "--cached", "--name-status", baseline], {
    cwd: repoRoot,
    throwOnError: false,
  });
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split("\t");
      return { path: parts.join("\t"), status: (status?.charAt(0) || "M") as ChangedFile["status"] };
    });
}
