import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pc from 'picocolors';
import { x } from 'tinyexec';
import { PROJECTS, type Project } from './lib/projects.ts';
import {
  formatTable,
  getEvalResultsDir,
  getEvalSupportDir,
  getProjectPath,
  getStorybookDir,
  REPOS_DIR,
} from './lib/utils.ts';

const SOURCE_PROJECT = 'mealdrop';
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
  sourceProjectName?: string;
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
      'repos-root': { type: 'string' },
      'source-project': { type: 'string' },
      project: { type: 'string', multiple: true },
      'skip-push': { type: 'boolean' },
      'commit-message': { type: 'string' },
    },
    strict: true,
  });

  const selectedProjects = values.project?.length
    ? PROJECTS.filter((project) => values.project?.includes(project.name))
    : PROJECTS;

  await syncBaselines({
    reposRoot: values['repos-root'],
    sourceProjectName: values['source-project'],
    projects: selectedProjects,
    push: !values['skip-push'],
    commitMessage: values['commit-message'],
    log: (message) => console.log(message),
  });
}

export async function syncBaselines(options: SyncBaselinesOptions = {}) {
  const log = options.log ?? (() => {});
  const reposRoot = resolve(options.reposRoot ?? REPOS_DIR);
  const sourceProjectName = options.sourceProjectName ?? SOURCE_PROJECT;
  const projects = options.projects ?? PROJECTS;
  const push = options.push ?? true;
  const commitMessage = options.commitMessage ?? COMMIT_MESSAGE;

  const sourceProject = projects.find((project) => project.name === sourceProjectName);
  if (!sourceProject) {
    throw new Error(`Source project not found: ${sourceProjectName}`);
  }

  const resolvedProjects = await Promise.all(
    projects.map(async (project) => {
      const paths = await resolveProjectPaths(project, join(reposRoot, project.name));
      return { project, paths };
    })
  );
  const source = resolvedProjects.find(({ project }) => project.name === sourceProjectName)!;

  await preflightRepos(resolvedProjects, source);

  const sourceFiles = await readSourceStorybookDir(source.paths.storybookDir);
  const results: SyncResult[] = [];

  for (const { project, paths } of resolvedProjects) {
    log(pc.bold(`\nSyncing ${project.name}`));
    const result = await syncProjectRepo({
      project,
      paths,
      sourceProjectName,
      sourceFiles,
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

export async function resolveProjectPaths(project: Project, repoRoot: string): Promise<ProjectPaths> {
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
  projects: Array<{ project: Project; paths: ProjectPaths }>,
  source: { project: Project; paths: ProjectPaths }
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

    if (project.name === source.project.name) {
      const dirtyFiles = await getDirtyFiles(paths.repoRoot);
      const allowedFiles = new Set(getManagedPaths(paths));
      const unexpected = dirtyFiles.filter((file) => !isManagedPath(file, allowedFiles));
      if (unexpected.length > 0) {
        throw new Error(
          `${project.name} has unrelated local changes: ${unexpected.join(', ')}`
        );
      }

      const isBehind = await isBehindOrigin(paths.repoRoot, project.branch);
      if (isBehind && dirtyFiles.length > 0) {
        throw new Error(
          `${project.name} is behind origin/${project.branch} and has local baseline edits; fast-forward first`
        );
      }
      continue;
    }

    const dirtyFiles = await getDirtyFiles(paths.repoRoot);
    if (dirtyFiles.length > 0) {
      throw new Error(`${project.name} has local changes: ${dirtyFiles.join(', ')}`);
    }
  }
}

async function syncProjectRepo(opts: {
  project: Project;
  paths: ProjectPaths;
  sourceProjectName: string;
  sourceFiles: Map<string, string>;
  push: boolean;
  commitMessage: string;
  log: (message: string) => void;
}) {
  const { project, paths, sourceProjectName, sourceFiles, push, commitMessage, log } = opts;

  if (project.name !== sourceProjectName) {
    await x('git', ['checkout', project.branch], {
      nodeOptions: { cwd: paths.repoRoot },
    });
    await x('git', ['pull', '--ff-only', 'origin', project.branch], {
      timeout: 120_000,
      nodeOptions: { cwd: paths.repoRoot },
    });
  }

  await syncStorybookDir(paths.storybookDir, sourceFiles);
  await rm(join(paths.repoRoot, 'eval-results'), { recursive: true, force: true });
  await mkdir(paths.evalResultsDir, { recursive: true });
  await writeFile(join(paths.evalResultsDir, 'data.json'), '{}\n');

  const managedPaths = getManagedPaths(paths);
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

async function readSourceStorybookDir(sourceDir: string) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = new Map<string, string>();

  for (const entry of entries) {
    const fullPath = join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await readSourceStorybookDir(fullPath);
      for (const [name, contents] of nested) {
        files.set(join(entry.name, name), contents);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.set(entry.name, await readFile(fullPath, 'utf-8'));
  }

  return files;
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

function getManagedPaths(paths: ProjectPaths) {
  return [
    relative(paths.repoRoot, paths.storybookDir),
    'eval-results',
  ];
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

async function isBehindOrigin(repoRoot: string, branch: string) {
  const result = await x(
    'git',
    ['merge-base', '--is-ancestor', `origin/${branch}`, 'HEAD'],
    {
      throwOnError: false,
      nodeOptions: { cwd: repoRoot },
    }
  );
  return result.exitCode !== 0;
}

async function getHead(repoRoot: string) {
  const result = await x('git', ['rev-parse', 'HEAD'], {
    nodeOptions: { cwd: repoRoot },
  });
  return result.stdout.trim();
}

function isManagedPath(file: string, managedPaths: Set<string>) {
  const normalizedFile = normalizeRepoPath(file);
  return [...managedPaths].some((managed) => {
    const normalizedManaged = normalizeRepoPath(managed);
    return (
      normalizedFile === normalizedManaged || normalizedFile.startsWith(`${normalizedManaged}/`)
    );
  });
}

function normalizeRepoPath(value: string) {
  return value.replace(/^\.\//, '').replace(/^\.(?=\/)/, '');
}
