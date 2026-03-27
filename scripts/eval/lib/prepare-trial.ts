import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Project, TrialPaths } from '../types';
import { CACHE_DIR, TRIALS_DIR, logStep, logSuccess, exec } from './utils';

/**
 * Clean environment for npm/npx commands that should use the public registry.
 * The storybook monorepo has a .npmrc pointing to localhost:6002 (verdaccio),
 * which leaks through process.env and breaks commands outside the monorepo.
 */
function cleanNpmEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  // Force public registry
  env.npm_config_registry = 'https://registry.npmjs.org/';
  // Remove any verdaccio-related env vars
  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_config_') && key !== 'npm_config_registry') {
      delete env[key];
    }
  }
  return env;
}

/**
 * Clone a repo to the cache (or reset to the target branch if already cached).
 */
async function ensureRepoClone(project: Project): Promise<string> {
  const cacheDir = join(CACHE_DIR, project.name);

  if (existsSync(cacheDir)) {
    logStep(`Updating cached clone for ${project.name}...`);
    const branch = project.branch || (await getDefaultBranch(cacheDir));
    await exec('git', ['fetch', 'origin'], { cwd: cacheDir });
    await exec('git', ['checkout', branch], { cwd: cacheDir });
    await exec('git', ['reset', '--hard', `origin/${branch}`], { cwd: cacheDir });
    await exec('git', ['clean', '-fdx', '-e', 'node_modules'], { cwd: cacheDir });
    return cacheDir;
  }

  logStep(`Cloning ${project.repo}...`);
  mkdirSync(CACHE_DIR, { recursive: true });
  const args = ['clone', '--depth', '1', project.repo, cacheDir];
  if (project.branch) {
    args.splice(1, 0, '--branch', project.branch);
  }
  await exec('git', args, { timeout: 120_000 });

  return cacheDir;
}

async function getDefaultBranch(repoDir: string): Promise<string> {
  const result = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoDir });
  return result.stdout.trim();
}

/**
 * Recursively remove storybook-related files from a directory.
 */
function cleanStorybookFiles(dir: string) {
  // Remove .storybook directory
  const storybookDir = join(dir, '.storybook');
  if (existsSync(storybookDir)) {
    rmSync(storybookDir, { recursive: true });
    logStep('Removed .storybook/');
  }

  // Remove story files
  const removedCount = removeStoryFiles(dir);
  if (removedCount > 0) {
    logStep(`Removed ${removedCount} story file(s)`);
  }
}

function removeStoryFiles(dir: string, count = 0): number {
  let removed = count;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'stories' || entry.name === '__stories__') {
          rmSync(fullPath, { recursive: true });
          removed++;
        } else {
          removed = removeStoryFiles(fullPath, removed);
        }
      } else if (/\.(stories|story)\.(tsx?|jsx?|mdx?)$/.test(entry.name)) {
        rmSync(fullPath);
        removed++;
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return removed;
}

/**
 * Detect the package manager and install dependencies.
 */
async function installDependencies(dir: string) {
  const env = cleanNpmEnv();
  if (existsSync(join(dir, 'pnpm-lock.yaml')) || existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    logStep('Installing dependencies with pnpm...');
    await exec('pnpm', ['install', '--no-frozen-lockfile'], { cwd: dir, timeout: 300_000, env });
  } else if (existsSync(join(dir, 'yarn.lock'))) {
    logStep('Installing dependencies with yarn...');
    if (existsSync(join(dir, '.yarnrc.yml'))) {
      await exec('yarn', ['install', '--no-immutable'], { cwd: dir, timeout: 300_000, env });
    } else {
      await exec('yarn', ['install'], { cwd: dir, timeout: 300_000, env });
    }
  } else if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) {
    logStep('Installing dependencies with bun...');
    await exec('bun', ['install'], { cwd: dir, timeout: 300_000, env });
  } else {
    logStep('Installing dependencies with npm...');
    await exec('npm', ['install'], { cwd: dir, timeout: 300_000, env });
  }
}

/**
 * Run `npx storybook@latest init --yes` to scaffold Storybook.
 */
async function initStorybook(dir: string) {
  logStep('Running storybook init...');
  const env = cleanNpmEnv();
  await exec('npx', ['storybook@latest', 'init', '--yes', '--no-dev'], {
    cwd: dir,
    timeout: 300_000,
    env: {
      ...env,
      STORYBOOK_DISABLE_TELEMETRY: '1',
    },
  });
}

/**
 * Prepare a trial: clone repo, clean storybook files, install deps, init storybook.
 */
export async function prepareTrial(project: Project, trialId: string): Promise<TrialPaths> {
  // 1. Ensure repo is in the cache
  const cacheDir = await ensureRepoClone(project);
  logSuccess(`Repo cached at ${cacheDir}`);

  // 2. Create trial directory and copy project
  const trialDir = join(TRIALS_DIR, trialId);
  const projectDest = join(trialDir, 'project');
  mkdirSync(trialDir, { recursive: true });

  logStep('Copying project to trial directory...');
  cpSync(cacheDir, projectDest, {
    recursive: true,
    filter: (src) => {
      // Exclude .git and node_modules from copy
      const relative = src.slice(cacheDir.length);
      if (relative.includes('node_modules')) return false;
      if (relative.startsWith('/.git') || relative === '/.git') return false;
      return true;
    },
  });

  // Initialize a fresh git repo so the agent can use git
  await exec('git', ['init'], { cwd: projectDest });
  await exec('git', ['add', '.'], { cwd: projectDest });
  await exec('git', ['commit', '-m', 'Initial commit', '--allow-empty'], {
    cwd: projectDest,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'eval',
      GIT_AUTHOR_EMAIL: 'eval@storybook.js.org',
      GIT_COMMITTER_NAME: 'eval',
      GIT_COMMITTER_EMAIL: 'eval@storybook.js.org',
    },
  });

  // 3. Determine the working path (handle monorepo projectDir)
  const projectPath = project.projectDir ? join(projectDest, project.projectDir) : projectDest;

  // 4. Clean storybook files
  cleanStorybookFiles(projectPath);

  // 5. Install dependencies
  await installDependencies(projectPath);
  logSuccess('Dependencies installed');

  // 6. Run storybook init
  await initStorybook(projectPath);
  logSuccess('Storybook initialized');

  // 7. Create results directory
  const resultsDir = join(trialDir, 'results');
  mkdirSync(resultsDir, { recursive: true });

  return { trialDir, projectPath, resultsDir };
}
