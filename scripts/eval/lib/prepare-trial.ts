import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import type { Project, TrialPaths } from '../types';
import { CACHE_DIR, TRIALS_DIR, logStep, logSuccess, exec } from './utils';

function cleanNpmEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  env.npm_config_registry = 'https://registry.npmjs.org/';
  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_config_') && key !== 'npm_config_registry') {
      delete env[key];
    }
  }
  return env;
}

async function installDeps(dir: string) {
  const env = cleanNpmEnv();
  const p = (f: string) => existsSync(join(dir, f));

  let cmd: string;
  let args: string[];
  if (p('pnpm-lock.yaml') || p('pnpm-workspace.yaml')) {
    cmd = 'pnpm';
    args = ['install', '--no-frozen-lockfile'];
  } else if (p('yarn.lock')) {
    cmd = 'yarn';
    args = p('.yarnrc.yml') ? ['install', '--no-immutable'] : ['install'];
  } else if (p('bun.lockb') || p('bun.lock')) {
    cmd = 'bun';
    args = ['install'];
  } else {
    cmd = 'npm';
    args = ['install', '--ignore-scripts'];
  }

  logStep(`Installing with ${cmd}...`);
  await exec(cmd, args, { cwd: dir, timeout: 300_000, env });
}

/**
 * Prepare a trial directory.
 *
 * First run per project: clone eval-baseline branch → install deps → cache it.
 * Subsequent runs: copy from cache. Agent starts immediately.
 */
export async function prepareTrial(project: Project, trialId: string): Promise<TrialPaths> {
  const cacheDir = join(CACHE_DIR, project.name);
  const trialDir = join(TRIALS_DIR, trialId);
  const repoRoot = join(trialDir, 'project');
  mkdirSync(trialDir, { recursive: true });

  if (existsSync(join(cacheDir, '.git'))) {
    // Fast path: copy from cache
    logStep('Copying from cache...');
    cpSync(cacheDir, repoRoot, { recursive: true });
  } else {
    // First run: clone directly to trial dir, install, then cache
    logStep(`Cloning ${project.repo}#${project.branch}...`);
    mkdirSync(CACHE_DIR, { recursive: true });
    await exec('git', ['clone', '--depth', '1', '--branch', project.branch!, project.repo, repoRoot], {
      timeout: 120_000,
    });

    const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
    await installDeps(projectPath);
    logSuccess('Dependencies installed');

    // Save to cache for next time
    logStep('Caching for future runs...');
    cpSync(repoRoot, cacheDir, { recursive: true });
  }

  const baselineResult = await exec('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
  const baselineCommit = baselineResult.stdout.trim();

  const projectPath = project.projectDir ? join(repoRoot, project.projectDir) : repoRoot;
  const resultsDir = join(trialDir, 'results');
  mkdirSync(resultsDir, { recursive: true });

  logSuccess('Trial ready');
  return { trialDir, repoRoot, projectPath, resultsDir, baselineCommit };
}
