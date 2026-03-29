import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Project, TrialWorkspace, Logger } from "../types.ts";
import { x } from "tinyexec";
import { installDeps } from "./package-manager.ts";
import { CACHE_DIR, TRIALS_DIR } from "./utils.ts";

/**
 * First run: clone eval-baseline -> install deps -> cache it.
 * Subsequent runs: copy from cache. Agent starts immediately.
 */
export async function prepareTrial(project: Project, trialId: string, logger: Logger): Promise<TrialWorkspace> {
  const cacheDir = join(CACHE_DIR, project.name);
  const trialDir = join(TRIALS_DIR, trialId);
  const repoRoot = join(trialDir, "project");
  await mkdir(trialDir, { recursive: true });

  if (existsSync(join(cacheDir, ".git"))) {
    logger.logStep("Copying from cache...");
    await cp(cacheDir, repoRoot, { recursive: true });
  } else {
    logger.logStep(`Cloning ${project.repo}#${project.branch}...`);
    await mkdir(CACHE_DIR, { recursive: true });
    await x("git", ["clone", "--depth", "1", "--branch", project.branch!, project.repo, repoRoot], {
      timeout: 120_000,
    });
    const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
    await installDeps(projectPath, logger);
    logger.logSuccess("Dependencies installed");
    logger.logStep("Caching for future runs...");
    await cp(repoRoot, cacheDir, { recursive: true });
  }

  const baselineCommit = (await x("git", ["rev-parse", "HEAD"], { nodeOptions: { cwd: repoRoot } })).stdout.trim();
  const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
  const resultsDir = join(trialDir, "results");
  await mkdir(resultsDir, { recursive: true });

  logger.logSuccess("Trial ready");
  return { trialDir, repoRoot, projectPath, resultsDir, baselineCommit };
}
