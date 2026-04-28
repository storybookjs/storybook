import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { x } from 'tinyexec';
import { esMain } from '../utils/esmain.ts';
import { installDeps } from './lib/package-manager.ts';
import { ensureSourceClone } from './lib/prepare-trial.ts';
import { PROJECTS, type Project } from './lib/projects.ts';
import {
  createLogger,
  formatHelp,
  formatTable,
  getProjectPath,
  getStorybookDir,
  NODE_EVAL_SYNC_STORYBOOK_VERSION_SCRIPT,
  REPOS_DIR,
} from './lib/utils.ts';

type HookArgs = {
  project: Project;
  repoRoot: string;
  projectPath: string;
  configDir: string;
};

type RunUpgrade = (args: HookArgs & { version: string }) => Promise<void>;
type RunInstall = (args: HookArgs) => Promise<void>;

export interface SyncStorybookVersionOptions {
  /** Storybook version to upgrade to (e.g. `latest`, `9.1.0`, `0.0.0-pr-1-sha-abc`). */
  version: string;
  /** Per-project clones live under `reposRoot/<project.name>`. Defaults to `REPOS_DIR`. */
  reposRoot?: string;
  /** Subset of benchmark projects (defaults to all). */
  projects?: Project[];
  /** Push the resulting commit to origin. Defaults to true. */
  push?: boolean;
  log?: (message: string) => void;
  /** Test hook; defaults to running `npx storybook@<version> upgrade ...` from the repo root. */
  runUpgrade?: RunUpgrade;
  /** Test hook; defaults to `installDeps(projectPath, ...)`. */
  installProjectDeps?: RunInstall;
}

export interface SyncResult {
  project: string;
  changed: boolean;
  commitSha?: string;
}

const cliOptions = {
  version: {
    type: 'string' as const,
    short: 'V',
    description: 'Storybook version to upgrade to (e.g. latest, 9.1.0, 0.0.0-pr-1-sha-abc)',
  },
  project: {
    type: 'string' as const,
    multiple: true,
    description: 'Project(s) to sync (repeatable)',
  },
  'skip-push': {
    type: 'boolean' as const,
    description: 'Commit locally but do not push',
  },
  help: { type: 'boolean' as const, short: 'h', description: 'Show this help and exit' },
};

if (esMain(import.meta.url)) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: cliOptions,
    strict: true,
  });

  if (values.help) {
    console.log(
      formatHelp(
        `node ${NODE_EVAL_SYNC_STORYBOOK_VERSION_SCRIPT} --version <version> [options]`,
        'Upgrade Storybook in every benchmark repo to the given version.',
        cliOptions
      )
    );
    process.exit(0);
  }

  if (!values.version) {
    console.error(
      `Error: --version is required. See \`node ${NODE_EVAL_SYNC_STORYBOOK_VERSION_SCRIPT} --help\`.`
    );
    process.exit(1);
  }

  const selected = values.project?.length
    ? PROJECTS.filter((p) => values.project?.includes(p.name))
    : PROJECTS;

  await syncStorybookVersion({
    version: values.version,
    projects: selected,
    push: !values['skip-push'],
    log: (message) => console.log(message),
  });
}

export async function syncStorybookVersion(
  options: SyncStorybookVersionOptions
): Promise<SyncResult[]> {
  const {
    version,
    reposRoot = REPOS_DIR,
    projects = PROJECTS,
    push = true,
    log = () => {},
    runUpgrade = defaultRunUpgrade,
    installProjectDeps = defaultInstallProjectDeps,
  } = options;

  if (!version) {
    throw new Error('syncStorybookVersion requires a non-empty `version`');
  }

  const logger = createLogger();
  const resolved = projects.map((project) => {
    const repoRoot = join(resolve(reposRoot), project.name);
    const projectPath = getProjectPath(repoRoot, project.projectDir);
    const configDir = relative(repoRoot, getStorybookDir(projectPath)) || '.storybook';
    return { project, repoRoot, projectPath, configDir };
  });

  // Preflight: auto-clone missing repos and fail fast if any working tree is dirty.
  for (const { project, repoRoot } of resolved) {
    await ensureSourceClone(project, repoRoot, logger);
    const { stdout } = await x('git', ['status', '--short'], { nodeOptions: { cwd: repoRoot } });
    if (stdout.trim()) {
      throw new Error(`${project.name} has local changes: ${stdout.trim().replace(/\n/g, ', ')}`);
    }
  }

  const results: SyncResult[] = [];
  for (const hookArgs of resolved) {
    const { project, repoRoot } = hookArgs;
    log(pc.bold(`\nUpgrading ${project.name} to ${version}`));

    await x('git', ['checkout', project.branch], { nodeOptions: { cwd: repoRoot } });
    await x('git', ['pull', '--ff-only', 'origin', project.branch], {
      timeout: 120_000,
      nodeOptions: { cwd: repoRoot },
    });

    // `.storybook/main.ts` needs node_modules to evaluate during `storybook upgrade`,
    // so install first. Install again afterwards because the upgrade's own install
    // does not always refresh sub-package lockfiles (e.g. wikitok's `frontend/`).
    await installProjectDeps(hookArgs);
    await runUpgrade({ version, ...hookArgs });
    await installProjectDeps(hookArgs);

    await x('git', ['add', '-A'], { nodeOptions: { cwd: repoRoot } });
    const diff = await x('git', ['diff', '--cached', '--quiet'], {
      throwOnError: false,
      nodeOptions: { cwd: repoRoot },
    });
    if (diff.exitCode === 0) {
      const ahead = await x('git', ['rev-list', '--count', `origin/${project.branch}..HEAD`], {
        nodeOptions: { cwd: repoRoot },
      });
      if (push && ahead.stdout.trim() !== '0') {
        await x('git', ['push', 'origin', project.branch], {
          timeout: 120_000,
          nodeOptions: { cwd: repoRoot },
        });
        const head = await x('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd: repoRoot } });
        const commitSha = head.stdout.trim();
        log(`  ${pc.dim('already on target version; pushed existing local commit')}`);
        results.push({ project: project.name, changed: true, commitSha });
      } else {
        log(`  ${pc.dim('already on target version')}`);
        results.push({ project: project.name, changed: false });
      }
      continue;
    }

    await x('git', ['commit', '--no-verify', '-m', `Eval: upgrade Storybook to ${version}`], {
      nodeOptions: { cwd: repoRoot },
    });
    const head = await x('git', ['rev-parse', 'HEAD'], { nodeOptions: { cwd: repoRoot } });
    const commitSha = head.stdout.trim();

    if (push) {
      await x('git', ['push', 'origin', project.branch], {
        timeout: 120_000,
        nodeOptions: { cwd: repoRoot },
      });
    }

    results.push({ project: project.name, changed: true, commitSha });
  }

  log(
    `\n${formatTable(
      ['Project', 'Changed', 'Commit'],
      results.map((r) => [r.project, r.changed ? 'yes' : 'no', r.commitSha?.slice(0, 8) ?? '-'])
    )}`
  );

  return results;
}

async function defaultRunUpgrade({
  version,
  repoRoot,
  configDir,
}: Parameters<RunUpgrade>[0]): Promise<void> {
  // `--yes`/`--force` already disable prompts. `CI`, `YARN_ENABLE_IMMUTABLE_INSTALLS`,
  // and `npm_config_frozen_lockfile` would refuse lockfile updates and leave
  // package.json and the lockfile out of sync, so unset them here.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
    npm_config_frozen_lockfile: 'false',
  };
  delete env.CI;

  await x(
    'npx',
    [
      `storybook@${version}`,
      'upgrade',
      '--yes',
      '--force',
      '--skip-check',
      '--skip-automigrations',
      '-c',
      configDir,
    ],
    { timeout: 900_000, nodeOptions: { cwd: repoRoot, env, stdio: 'inherit' } }
  );
}

async function defaultInstallProjectDeps({
  repoRoot,
  projectPath,
}: Parameters<RunInstall>[0]): Promise<void> {
  await installDeps(projectPath, createLogger(), undefined, { stopAt: repoRoot });
}
