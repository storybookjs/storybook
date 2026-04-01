import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from './utils.ts';
import type { Project } from './projects.ts';
import { x } from 'tinyexec';
import { installDeps } from './package-manager.ts';
import { REPOS_DIR, TRIALS_DIR } from './utils.ts';

export interface TrialWorkspace {
  trialDir: string;
  sourceDir: string;
  repoRoot: string;
  projectPath: string;
  resultsDir: string;
  baselineCommit: string;
  trialBranch: string;
}

/**
 * Maintain one persistent source clone per project and create a fresh worktree for every trial.
 */
export async function prepareTrial(
  project: Project,
  trialId: string,
  logger: Logger
): Promise<TrialWorkspace> {
  const sourceDir = join(REPOS_DIR, project.name);
  const trialDir = join(TRIALS_DIR, trialId);
  const repoRoot = join(trialDir, 'project');
  const trialBranch = `trial/${trialId}`;
  await mkdir(trialDir, { recursive: true });

  await ensureSourceClone(project, sourceDir, logger);
  const baselineCommit = await syncSourceClone(project, sourceDir, logger);
  await createTrialWorktree({
    sourceDir,
    trialBranch,
    repoRoot,
    baseBranch: project.branch,
    logger,
  });

  const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
  const resultsDir = join(repoRoot, 'eval-results');
  await mkdir(resultsDir, { recursive: true });
  await installDeps(projectPath, logger, undefined, { stopAt: repoRoot });

  logger.logSuccess('Trial ready');
  return { trialDir, sourceDir, repoRoot, projectPath, resultsDir, baselineCommit, trialBranch };
}

async function ensureSourceClone(project: Project, sourceDir: string, logger: Logger) {
  await mkdir(REPOS_DIR, { recursive: true });

  if (existsSync(join(sourceDir, '.git'))) {
    return;
  }

  if (existsSync(sourceDir)) {
    await rm(sourceDir, { recursive: true, force: true });
  }

  logger.logStep(`Cloning source repo ${project.repo}#${project.branch}...`);
  await x('git', ['clone', '--branch', project.branch, project.repo, sourceDir], {
    timeout: 120_000,
  });
}

async function syncSourceClone(project: Project, sourceDir: string, logger: Logger) {
  logger.logStep(`Syncing ${project.name} source clone...`);
  await x('git', ['remote', 'set-url', 'origin', project.repo], {
    nodeOptions: { cwd: sourceDir },
  });
  await x('git', ['fetch', 'origin', '--prune'], {
    timeout: 120_000,
    nodeOptions: { cwd: sourceDir },
  });
  await x('git', ['checkout', project.branch], { nodeOptions: { cwd: sourceDir } });
  await x('git', ['reset', '--hard', `origin/${project.branch}`], {
    nodeOptions: { cwd: sourceDir },
  });

  return getGitHead(sourceDir);
}

async function getGitHead(cwd: string): Promise<string> {
  return (await x('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd } })).stdout.trim();
}

async function createTrialWorktree({
  sourceDir,
  trialBranch,
  repoRoot,
  baseBranch,
  logger,
}: {
  sourceDir: string;
  trialBranch: string;
  repoRoot: string;
  baseBranch: string;
  logger: Logger;
}) {
  logger.logStep(`Creating worktree for ${trialBranch}...`);
  await x('git', ['worktree', 'add', '-b', trialBranch, repoRoot, baseBranch], {
    timeout: 120_000,
    nodeOptions: { cwd: sourceDir },
  });
}
