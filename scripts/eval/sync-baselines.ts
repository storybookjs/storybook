import { existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { x } from 'tinyexec';
import { BASELINE_STORYBOOK_FILES } from './lib/baseline-template-files.ts';
import { PROJECTS, type Project } from './lib/projects.ts';
import {
  formatTable,
  getEvalResultsDir,
  getEvalSupportDir,
  getProjectPath,
  getStorybookDir,
  REPOS_DIR,
} from './lib/utils.ts';

const COMMIT_MESSAGE = 'Eval: sync .storybook baseline';

export interface ProjectPaths {
  repoRoot: string;
  projectPath: string;
  storybookDir: string;
  evalSupportDir: string;
  evalResultsDir: string;
}

export interface SyncBaselinesOptions {
  reposRoot?: string;
  projects?: Project[];
  push?: boolean;
  commitMessage?: string;
  log?: (message: string) => void;
}

export interface SyncResult {
  project: string;
  changed: boolean;
  commitSha?: string;
}

const main = import.meta.url === `file://${process.argv[1]}`;

if (main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      project: { type: 'string', multiple: true },
      'skip-push': { type: 'boolean' },
    },
    strict: true,
  });

  const selectedProjects = values.project?.length
    ? PROJECTS.filter((project) => values.project?.includes(project.name))
    : PROJECTS;

  await syncBaselines({
    projects: selectedProjects,
    push: !values['skip-push'],
    log: (message) => console.log(message),
  });
}

export async function syncBaselines(options: SyncBaselinesOptions = {}) {
  const log = options.log ?? (() => {});
  const reposRoot = resolve(options.reposRoot ?? REPOS_DIR);
  const projects = options.projects ?? PROJECTS;
  const push = options.push ?? true;
  const commitMessage = options.commitMessage ?? COMMIT_MESSAGE;

  const resolvedProjects = await Promise.all(
    projects.map(async (project) => {
      const paths = await resolveProjectPaths(project, join(reposRoot, project.name));
      return { project, paths };
    })
  );

  await preflightRepos(resolvedProjects);
  const baselineFiles = await readBaselineStorybookDir();
  const results: SyncResult[] = [];

  for (const { project, paths } of resolvedProjects) {
    log(pc.bold(`\nSyncing ${project.name}`));
    const result = await syncProjectRepo({
      project,
      paths,
      baselineFiles,
      push,
      commitMessage,
      log,
    });
    results.push({
      project: project.name,
      changed: result.changed,
      commitSha: result.commitSha,
    });
  }

  log(
    `\n${formatTable(
      ['Project', 'Changed', 'Commit'],
      results.map((result) => [
        result.project,
        result.changed ? 'yes' : 'no',
        result.commitSha ? result.commitSha.slice(0, 8) : '-',
      ])
    )}`
  );

  return results;
}

export async function resolveProjectPaths(
  project: Project,
  repoRoot: string
): Promise<ProjectPaths> {
  const projectPath = getProjectPath(repoRoot, project.projectDir);
  const storybookDir = getStorybookDir(projectPath);
  if (!(await findStorybookMainFile(projectPath))) {
    throw new Error(`No .storybook/main.* found for ${project.name}`);
  }

  return {
    repoRoot,
    projectPath,
    storybookDir,
    evalSupportDir: getEvalSupportDir(projectPath),
    evalResultsDir: getEvalResultsDir(projectPath),
  };
}

async function preflightRepos(
  projects: Array<{ project: Project; paths: ProjectPaths }>
) {
  for (const { project, paths } of projects) {
    if (!existsSync(paths.repoRoot)) {
      throw new Error(`Repo missing for ${project.name}: ${paths.repoRoot}`);
    }

    const currentBranch = await getCurrentBranch(paths.repoRoot);
    if (currentBranch !== project.branch) {
      throw new Error(
        `${project.name} must be on ${project.branch} before sync (found ${currentBranch || 'detached'})`
      );
    }

    await x('git', ['fetch', 'origin', '--prune'], {
      timeout: 120_000,
      nodeOptions: { cwd: paths.repoRoot },
    });

    const dirtyFiles = await getDirtyFiles(paths.repoRoot);
    if (dirtyFiles.length > 0) {
      throw new Error(`${project.name} has local changes: ${dirtyFiles.join(', ')}`);
    }
  }
}

async function syncProjectRepo(opts: {
  project: Project;
  paths: ProjectPaths;
  baselineFiles: Map<string, string>;
  push: boolean;
  commitMessage: string;
  log: (message: string) => void;
}) {
  const { project, paths, baselineFiles, push, commitMessage, log } = opts;
  const additionalManagedPaths = await getAdditionalManagedPaths(paths);

  await x('git', ['checkout', project.branch], {
    nodeOptions: { cwd: paths.repoRoot },
  });
  await x('git', ['pull', '--ff-only', 'origin', project.branch], {
    timeout: 120_000,
    nodeOptions: { cwd: paths.repoRoot },
  });

  await syncStorybookDir(paths.storybookDir, baselineFiles);
  await rm(getLegacyEvalResultsDir(paths.projectPath), { recursive: true, force: true });
  await mkdir(paths.evalResultsDir, { recursive: true });
  await writeFile(join(paths.evalResultsDir, 'data.json'), '{}\n');

  const managedPaths = getManagedPaths(paths, additionalManagedPaths);
  await x('git', ['add', '-A', '--', ...managedPaths], {
    nodeOptions: { cwd: paths.repoRoot },
  });

  const changed = await hasManagedChanges(paths.repoRoot, managedPaths);
  if (!changed) {
    log(`  ${pc.dim('no baseline changes')}`);
    return { changed: false as const };
  }

  await x('git', ['commit', '--no-verify', '-m', commitMessage], {
    nodeOptions: { cwd: paths.repoRoot },
  });
  const commitSha = await getHead(paths.repoRoot);

  if (push) {
    await x('git', ['push', 'origin', project.branch], {
      timeout: 120_000,
      nodeOptions: { cwd: paths.repoRoot },
    });
  }

  return { changed: true as const, commitSha };
}

async function readBaselineStorybookDir() {
  return new Map(Object.entries(BASELINE_STORYBOOK_FILES));
}

async function syncStorybookDir(targetDir: string, sourceFiles: Map<string, string>) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  for (const [name, contents] of sourceFiles) {
    const targetPath = join(targetDir, name);
    await mkdir(join(targetPath, '..'), { recursive: true });
    const rewritten = contents.replace(
      /(?:\.\.\/)+eval-results\/data\.json/g,
      '../eval-results/data.json'
    );
    await writeFile(targetPath, rewritten);
  }
}

async function findStorybookMainFile(projectPath: string) {
  const candidates = ['main.ts', 'main.js', 'main.mts', 'main.mjs', 'main.cjs'].map((file) =>
    join(projectPath, '.storybook', file)
  );
  for (const candidate of candidates) {
    if (existsSync(candidate) && (await stat(candidate)).isFile()) {
      return candidate;
    }
  }

  return undefined;
}

function getManagedPaths(paths: ProjectPaths, extraPaths: string[] = []) {
  return [relative(paths.repoRoot, paths.storybookDir), ...extraPaths];
}

async function getAdditionalManagedPaths(paths: ProjectPaths) {
  const legacyEvalResultsPath = normalizeRepoPath(
    relative(paths.repoRoot, getLegacyEvalResultsDir(paths.projectPath))
  );

  if (!legacyEvalResultsPath) {
    return [];
  }

  const legacyEvalResultsExists = existsSync(join(paths.repoRoot, legacyEvalResultsPath));
  if (legacyEvalResultsExists) {
    return [legacyEvalResultsPath];
  }

  const tracked = await x('git', ['ls-files', '--error-unmatch', '--', legacyEvalResultsPath], {
    throwOnError: false,
    nodeOptions: { cwd: paths.repoRoot },
  });
  return tracked.exitCode === 0 ? [legacyEvalResultsPath] : [];
}

function getLegacyEvalResultsDir(projectPath: string) {
  return join(projectPath, 'eval-results');
}

async function getDirtyFiles(repoRoot: string) {
  const result = await x('git', ['status', '--short'], {
    nodeOptions: { cwd: repoRoot },
  });
  return result.stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.slice(3).trim());
}

async function hasManagedChanges(repoRoot: string, managedPaths: string[]) {
  const result = await x('git', ['diff', '--cached', '--quiet', '--', ...managedPaths], {
    throwOnError: false,
    nodeOptions: { cwd: repoRoot },
  });
  return result.exitCode !== 0;
}

async function getCurrentBranch(repoRoot: string) {
  const result = await x('git', ['branch', '--show-current'], {
    nodeOptions: { cwd: repoRoot },
  });
  return result.stdout.trim();
}

async function getHead(repoRoot: string) {
  const result = await x('git', ['rev-parse', 'HEAD'], {
    nodeOptions: { cwd: repoRoot },
  });
  return result.stdout.trim();
}

function normalizeRepoPath(value: string) {
  return value.replace(/^\.\//, '').replace(/^\.(?=\/)/, '');
}
