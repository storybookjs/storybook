/**
 * One-time script to prepare eval baseline repos.
 *
 * For each benchmark project:
 * 1. Fork the repo to your GitHub account
 * 2. Clone the fork
 * 3. Clean storybook files, install deps, run `storybook init`
 * 4. Commit and push as `eval-baseline` branch
 *
 * After this, each eval trial just does a fast shallow clone of the
 * prepared branch — no more storybook init during trials.
 *
 * Usage: node scripts/eval/prepare-repos.ts
 *
 * NOTE: The REPOS list below contains the *original* upstream repos
 * (e.g. "yannbf/mealdrop"), which is distinct from the *fork* URLs in
 * config.ts PROJECTS (e.g. "kasperpeulen/mealdrop"). This script forks
 * and pushes eval-baseline branches to those forks.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { x } from "tinyexec";
import { createLogger } from "./lib/utils.ts";
import { installDeps } from "./lib/package-manager.ts";

const logger = createLogger();

const EVAL_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "storybook-eval");
const PREP_DIR = join(EVAL_ROOT, "prepared-repos");
const BASELINE_BRANCH = "eval-baseline";

/** Known storybook init starter files that are safe to remove. */
const STARTER_FILES = new Set([
  'button.stories.ts', 'button.stories.tsx', 'button.stories.js', 'button.stories.jsx',
  'header.stories.ts', 'header.stories.tsx', 'header.stories.js', 'header.stories.jsx',
  'page.stories.ts', 'page.stories.tsx', 'page.stories.js', 'page.stories.jsx',
  'button.tsx', 'button.jsx', 'button.ts', 'button.js', 'button.css',
  'header.tsx', 'header.jsx', 'header.ts', 'header.js', 'header.css',
  'page.tsx', 'page.jsx', 'page.ts', 'page.js', 'page.css',
  'configure-your-project.mdx',
]);

interface BenchmarkRepo {
  name: string;
  repo: string;
  branch?: string;
  projectDir?: string;
}

const REPOS: BenchmarkRepo[] = [
  { name: 'mealdrop', repo: 'yannbf/mealdrop', branch: 'without-storybook' },
  { name: 'edgy', repo: 'catherineisonline/edgy' },
  { name: 'wikitok', repo: 'IsaacGemal/wikitok', projectDir: 'frontend' },
  { name: 'baklava', repo: 'fortanix/baklava', branch: 'master' },
  { name: 'echarts', repo: 'tmkx/echarts-react' },
  { name: 'evergreen-ci', repo: 'evergreen-ci/ui', projectDir: 'packages/lib' },
];

function cleanNpmEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v != null && !k.startsWith('npm_config_')) env[k] = v;
  }
  env.npm_config_registry = 'https://registry.npmjs.org/';
  return env;
}

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'eval',
  GIT_AUTHOR_EMAIL: 'eval@storybook.js.org',
  GIT_COMMITTER_NAME: 'eval',
  GIT_COMMITTER_EMAIL: 'eval@storybook.js.org',
};

async function run(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string>; timeout?: number } = {}) {
  return x(cmd, args, { timeout: opts.timeout, nodeOptions: { cwd: opts.cwd, env: opts.env as NodeJS.ProcessEnv } });
}

function stripStorybookDeps(pkgPath: string) {
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  let changed = false;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const key of Object.keys(deps)) {
      if (key === 'storybook' || key.startsWith('@storybook/') || key === 'eslint-plugin-storybook') {
        delete deps[key];
        changed = true;
      }
    }
  }
  if (pkg.scripts) {
    for (const key of Object.keys(pkg.scripts)) {
      if (key === 'storybook' || key === 'build-storybook') {
        delete pkg.scripts[key];
        changed = true;
      }
    }
  }
  if (changed) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function cleanStorybookFiles(dir: string) {
  for (const name of ['.storybook', 'storybook-static']) {
    const target = join(dir, name);
    if (existsSync(target)) rmSync(target, { recursive: true });
  }
  for (const storiesDir of ['stories', join('src', 'stories')]) {
    const target = join(dir, storiesDir);
    if (existsSync(target) && isStarterDirectory(target)) {
      rmSync(target, { recursive: true });
    }
  }
  stripStorybookDeps(join(dir, 'package.json'));
}

function isStarterDirectory(dir: string): boolean {
  try {
    return readdirSync(dir, { withFileTypes: true }).every(
      (e) => !e.isDirectory() && STARTER_FILES.has(e.name.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function prepareRepo(repo: BenchmarkRepo) {
  logger.log(`\n=== ${repo.name} ===`);
  const repoDir = join(PREP_DIR, repo.name);

  // 1. Fork (idempotent — gh fork is a no-op if already forked)
  logger.logStep(`Forking ${repo.repo}...`);
  try {
    await run('gh', ['repo', 'fork', repo.repo, '--clone=false']);
  } catch {
    logger.log(`  ! Fork may already exist, continuing...`);
  }

  // Figure out the fork name (gh forks to authenticated user)
  const whoami = (await run('gh', ['api', 'user', '--jq', '.login'])).stdout.trim();
  const forkSlug = `${whoami}/${repo.repo.split('/')[1]}`;
  logger.logStep(`Fork: ${forkSlug}`);

  // 2. Clone (or pull) the fork
  if (existsSync(repoDir)) {
    logger.logStep(`Updating existing clone...`);
    await run('git', ['fetch', 'origin'], { cwd: repoDir });
    const branch = repo.branch || (await run('git', ['remote', 'show', 'origin'], { cwd: repoDir }))
      .stdout.match(/HEAD branch:\s*(\S+)/)?.[1] || 'main';
    await run('git', ['checkout', branch], { cwd: repoDir });
    await run('git', ['reset', '--hard', `origin/${branch}`], { cwd: repoDir });
    await run('git', ['clean', '-fdx', '-e', 'node_modules'], { cwd: repoDir });
  } else {
    logger.logStep(`Cloning ${forkSlug}...`);
    const cloneArgs = ['clone', `https://github.com/${forkSlug}.git`, repoDir];
    if (repo.branch) cloneArgs.splice(1, 0, '--branch', repo.branch);
    await run('git', cloneArgs, { timeout: 120_000 });
  }

  // 3. Create eval-baseline branch
  logger.logStep(`Creating ${BASELINE_BRANCH} branch...`);
  await run('git', ['checkout', '-B', BASELINE_BRANCH], { cwd: repoDir });

  // 4. Clean storybook files
  const projectDir = repo.projectDir ? join(repoDir, repo.projectDir) : repoDir;
  cleanStorybookFiles(projectDir);

  // 5. Install dependencies
  await installDeps(projectDir, logger, cleanNpmEnv());

  // 6. Run storybook init
  logger.logStep(`Running storybook init...`);
  const env = cleanNpmEnv();
  await run('npx', ['storybook@latest', 'init', '--yes', '--no-dev'], {
    cwd: projectDir,
    env: { ...env, STORYBOOK_DISABLE_TELEMETRY: '1' },
    timeout: 300_000,
  });

  // 7. Post-init install
  await installDeps(projectDir, logger, cleanNpmEnv());

  // 8. Commit everything
  logger.logStep(`Committing baseline...`);
  await run('git', ['add', '-A'], { cwd: repoDir, env: { ...cleanNpmEnv(), ...GIT_ENV } });
  await run('git', ['commit', '-m', 'eval baseline after storybook init', '--allow-empty'], {
    cwd: repoDir,
    env: { ...cleanNpmEnv(), ...GIT_ENV },
  });

  // 9. Force-push the baseline branch
  logger.logStep(`Pushing ${BASELINE_BRANCH}...`);
  await run('git', ['push', '-f', 'origin', BASELINE_BRANCH], { cwd: repoDir });

  logger.logSuccess(`${repo.name} ready at ${forkSlug}#${BASELINE_BRANCH}`);
  return { name: repo.name, forkRepo: `https://github.com/${forkSlug}`, branch: BASELINE_BRANCH, projectDir: repo.projectDir };
}

// --- Main ---
mkdirSync(PREP_DIR, { recursive: true });

logger.log(`Preparing eval baseline repos`);
logger.log(`Output: ${PREP_DIR}\n`);

const results = [];
for (const repo of REPOS) {
  try {
    const result = await prepareRepo(repo);
    results.push(result);
  } catch (error) {
    logger.logError(`Failed: ${error instanceof Error ? error.message : error}`);
  }
}

logger.log(`\n\nPrepared repos:`);
for (const r of results) {
  logger.logSuccess(`${r.name}: ${r.forkRepo}#${r.branch}${r.projectDir ? ` (${r.projectDir})` : ''}`);
}
