import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from './utils.ts';
import type { Project } from './projects.ts';
import { x } from 'tinyexec';
import { installDeps } from './package-manager.ts';
import { CACHE_DIR, TRIALS_DIR } from './utils.ts';

const CACHE_INFO_SUFFIX = '.json';

export interface TrialWorkspace {
  trialDir: string;
  repoRoot: string;
  projectPath: string;
  resultsDir: string;
  baselineCommit: string;
}

export interface TrialCacheInfo {
  repo: string;
  branch: string;
  baselineCommit: string;
}

/**
 * First run: clone eval-baseline -> install deps -> cache it.
 * Subsequent runs: copy from cache. Agent starts immediately.
 */
export async function prepareTrial(
  project: Project,
  trialId: string,
  logger: Logger
): Promise<TrialWorkspace> {
  const cacheDir = join(CACHE_DIR, project.name);
  const cacheInfoPath = join(CACHE_DIR, `${project.name}${CACHE_INFO_SUFFIX}`);
  const trialDir = join(TRIALS_DIR, trialId);
  const repoRoot = join(trialDir, 'project');
  await mkdir(trialDir, { recursive: true });

  if (await canReuseCache(project, cacheDir, cacheInfoPath, logger)) {
    logger.logStep('Copying from cache...');
    await cp(cacheDir, repoRoot, { recursive: true });
  } else {
    logger.logStep(`Cloning ${project.repo}#${project.branch}...`);
    await mkdir(CACHE_DIR, { recursive: true });
    await x('git', ['clone', '--depth', '1', '--branch', project.branch, project.repo, repoRoot], {
      timeout: 120_000,
    });
    const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
    await installDeps(projectPath, logger, undefined, { stopAt: repoRoot });
    logger.logSuccess('Dependencies installed');
    logger.logStep('Caching for future runs...');
    const baselineCommit = await getGitHead(repoRoot);
    await persistCache(cacheDir, cacheInfoPath, repoRoot, {
      repo: project.repo,
      branch: project.branch,
      baselineCommit,
    });
  }

  const baselineCommit = await getGitHead(repoRoot);
  const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
  const resultsDir = join(trialDir, 'results');
  await mkdir(resultsDir, { recursive: true });

  logger.logSuccess('Trial ready');
  return { trialDir, repoRoot, projectPath, resultsDir, baselineCommit };
}

export function getCacheRefreshReason(
  project: Project,
  cacheInfo: TrialCacheInfo,
  remoteHead?: string
): string | undefined {
  if (cacheInfo.repo !== project.repo) {
    return `repo changed (${cacheInfo.repo} → ${project.repo})`;
  }
  if (cacheInfo.branch !== project.branch) {
    return `branch changed (${cacheInfo.branch} → ${project.branch})`;
  }
  if (remoteHead && cacheInfo.baselineCommit !== remoteHead) {
    return `baseline branch advanced (${cacheInfo.baselineCommit.slice(0, 7)} → ${remoteHead.slice(0, 7)})`;
  }
  return undefined;
}

async function canReuseCache(
  project: Project,
  cacheDir: string,
  cacheInfoPath: string,
  logger: Logger
): Promise<boolean> {
  if (!existsSync(join(cacheDir, '.git'))) {
    return false;
  }

  const cacheInfo = await readCacheInfo(cacheInfoPath);
  if (!cacheInfo) {
    logger.logStep('Refreshing cache (missing or invalid cache metadata)...');
    await clearCache(cacheDir, cacheInfoPath);
    return false;
  }

  const remoteHead = await getRemoteBranchHead(project.repo, project.branch, logger);
  const refreshReason = getCacheRefreshReason(project, cacheInfo, remoteHead);
  if (!refreshReason) {
    return true;
  }

  logger.logStep(`Refreshing cache (${refreshReason})...`);
  await clearCache(cacheDir, cacheInfoPath);
  return false;
}

async function persistCache(
  cacheDir: string,
  cacheInfoPath: string,
  repoRoot: string,
  cacheInfo: TrialCacheInfo
) {
  await clearCache(cacheDir, cacheInfoPath);
  await cp(repoRoot, cacheDir, { recursive: true });
  await writeFile(cacheInfoPath, JSON.stringify(cacheInfo, null, 2));
}

async function readCacheInfo(cacheInfoPath: string): Promise<TrialCacheInfo | undefined> {
  if (!existsSync(cacheInfoPath)) {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(cacheInfoPath, 'utf-8')) as TrialCacheInfo;
  } catch {
    return undefined;
  }
}

async function getGitHead(cwd: string): Promise<string> {
  return (await x('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd } })).stdout.trim();
}

async function getRemoteBranchHead(
  repo: string,
  branch: string,
  logger: Logger
): Promise<string | undefined> {
  const result = await x('git', ['ls-remote', repo, `refs/heads/${branch}`], {
    throwOnError: false,
    timeout: 120_000,
  });
  if (result.exitCode !== 0) {
    logger.logStep(`Could not verify remote HEAD for ${repo}#${branch}; reusing cache as-is.`);
    return undefined;
  }

  const line = result.stdout.trim().split('\n').find(Boolean);
  return line?.split('\t')[0]?.trim() || undefined;
}

async function clearCache(cacheDir: string, cacheInfoPath: string) {
  await Promise.all([
    rm(cacheDir, { recursive: true, force: true }),
    rm(cacheInfoPath, { force: true }),
  ]);
}
