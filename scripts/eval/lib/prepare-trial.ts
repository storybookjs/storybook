import { existsSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import type { Project, TrialPaths, Logger } from "../types.ts";
import { CACHE_DIR, TRIALS_DIR, exec } from "./utils.ts";

async function installDeps(dir: string, logger: Logger) {
  const has = (f: string) => existsSync(join(dir, f));
  const [cmd, args]: [string, string[]] = has("pnpm-lock.yaml") || has("pnpm-workspace.yaml")
    ? ["pnpm", ["install", "--no-frozen-lockfile"]]
    : has("yarn.lock")
      ? ["yarn", has(".yarnrc.yml") ? ["install", "--no-immutable"] : ["install"]]
      : has("bun.lockb") || has("bun.lock")
        ? ["bun", ["install"]]
        : ["npm", ["install", "--ignore-scripts"]];

  logger.logStep(`Installing with ${cmd}...`);
  await exec(cmd, args, { cwd: dir, timeout: 300_000 });
}

/**
 * First run: clone eval-baseline -> install deps -> cache it.
 * Subsequent runs: copy from cache. Agent starts immediately.
 */
export async function prepareTrial(project: Project, trialId: string, logger: Logger): Promise<TrialPaths> {
  const cacheDir = join(CACHE_DIR, project.name);
  const trialDir = join(TRIALS_DIR, trialId);
  const repoRoot = join(trialDir, "project");
  mkdirSync(trialDir, { recursive: true });

  if (existsSync(join(cacheDir, ".git"))) {
    logger.logStep("Copying from cache...");
    cpSync(cacheDir, repoRoot, { recursive: true });
  } else {
    logger.logStep(`Cloning ${project.repo}#${project.branch}...`);
    mkdirSync(CACHE_DIR, { recursive: true });
    await exec("git", ["clone", "--depth", "1", "--branch", project.branch!, project.repo, repoRoot], {
      timeout: 120_000,
    });
    const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
    await installDeps(projectPath, logger);
    logger.logSuccess("Dependencies installed");
    logger.logStep("Caching for future runs...");
    cpSync(repoRoot, cacheDir, { recursive: true });
  }

  const baselineCommit = (await exec("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).stdout.trim();
  const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
  const resultsDir = join(trialDir, "results");
  mkdirSync(resultsDir, { recursive: true });

  logger.logSuccess("Trial ready");
  return { trialDir, repoRoot, projectPath, resultsDir, baselineCommit };
}
