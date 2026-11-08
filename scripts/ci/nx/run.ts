// Run the NX tasks that cover a CircleCI workflow (see plan.ts) on NX Cloud. The commands run at
// the same time, in the same NX Cloud pipeline.
//
// Usage: run.ts --workflow=<workflows> [--env=linux|windows] [--base=<sha>] [--dry-run]
//
// - `--env=windows` runs the plan's Windows tasks instead of its Linux ones (circleci-dte.ts).
// - `--base` runs only the tasks a change since that commit reaches: `nx affected` with Nx's
//   task-level selection, which picks a task only when the diff touches one of its inputs.
//   Without it, every task of the plan runs (`nx run-many`).
//
// CircleCI's setup job works out the same commands in-process (`nxCommands`, select.ts), and
// nx-main then runs them without this script.
//
// Focused runs read the changed files since `CI_CHANGED_FILES_BASE` (scripts/ci/utils/changed-files.ts).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import type { ProjectGraph as NxProjectGraph } from 'nx/src/config/project-graph.js';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects.js';
import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { esMain } from '../../utils/esmain.ts';
import { changedFilesFromEnvironment } from '../utils/changed-files.ts';
import type { Workflow } from '../utils/types.ts';
import {
  type Group,
  groupTasks,
  parseWorkflows,
  planFor,
  projectPattern,
  windowsTasksOf,
} from './plan.ts';

function yarn(args: string[], input?: string) {
  const result = spawnSync('yarn', args, {
    cwd: ROOT_DIRECTORY,
    encoding: 'utf8',
    input,
    maxBuffer: 1024 ** 3,
    // Windows resolves `yarn` through yarn.cmd.
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`yarn ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

// What the commands of a run are made from: each project's targets, and the projects an Nx
// project pattern selects (`nx show projects --projects=<pattern>`).
export type Workspace = {
  targetsByProject: ReadonlyMap<string, ReadonlySet<string>>;
  matching: (pattern: string) => string[];
};

type ProjectGraph = { nodes: Record<string, { data: { targets?: Record<string, unknown> } }> };

const targetsOf = (graph: ProjectGraph) =>
  new Map(
    Object.entries(graph.nodes).map(([name, node]) => [
      name,
      new Set(Object.keys(node.data.targets ?? {})),
    ])
  );

// From a project graph built in-process, as select.ts does, so that it starts no Nx processes for
// it. `nx show projects --projects` matches with the same function.
export const workspaceOf = (graph: NxProjectGraph): Workspace => ({
  targetsByProject: targetsOf(graph),
  matching: (pattern) => findMatchingProjects(pattern.split(','), graph.nodes),
});

// From the Nx CLI, for this script on its own (run.test.ts keeps it equal to `workspaceOf`).
export function cliWorkspace(): Workspace {
  const file = join(mkdtempSync(join(tmpdir(), 'nx-graph-')), 'graph.json');
  yarn(['nx', 'graph', `--file=${file}`]);
  const { graph } = JSON.parse(readFileSync(file, 'utf8')) as { graph: ProjectGraph };
  return {
    targetsByProject: targetsOf(graph),
    matching: (pattern) =>
      JSON.parse(yarn(['nx', 'show', 'projects', `--projects=${pattern}`, '--json'])),
  };
}

// One group as an Nx command line, without `yarn`.
export function commandFor(
  { targets, projects }: { targets: readonly string[]; projects: string },
  base: string | undefined
) {
  return [
    'nx',
    ...(base
      ? // `affected` has no `--projects`: everything but the group is excluded instead.
        [
          'affected',
          `--targets=${targets.join(',')}`,
          `--exclude=${['*', ...projects.split(',').map((p) => `!${p}`)].join(',')}`,
          `--base=${base}`,
          '--head=HEAD',
        ]
      : ['run-many', `--targets=${targets.join(',')}`, `--projects=${projects}`]),
    '--configuration=production',
  ];
}

// Name the projects of a run by its workflows' tags when they select exactly the group's projects
// (the case for every workflow but `focus`), so the command reads as what it runs.
function projectsOf(group: Group, pattern: string | undefined, workspace: Workspace) {
  if (pattern) {
    const tagged = workspace
      .matching(pattern)
      .filter((project) =>
        group.targets.some((target) => workspace.targetsByProject.get(project)?.has(target))
      );
    if (JSON.stringify(tagged.sort()) === JSON.stringify([...group.projects].sort())) {
      return pattern;
    }
    console.log(`${pattern} does not select exactly the planned projects; naming them instead.`);
  }
  return group.projects.join(',');
}

// The Nx commands, without `yarn`, that run the plan's tasks for `env`.
export function nxCommands({
  selected,
  env,
  base,
  changedFiles,
  workspace,
}: {
  selected: readonly Workflow[];
  env: 'linux' | 'windows';
  base: string | undefined;
  changedFiles: readonly string[];
  workspace: Workspace;
}): string[][] {
  const plan = planFor(selected, changedFiles);

  if (plan.missing.length > 0) {
    throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
  }

  const { targetsByProject } = workspace;
  const wanted = new Map<string, Set<string>>();
  const want = (project: string, target: string) =>
    wanted.set(project, (wanted.get(project) ?? new Set()).add(target));

  const tasks = env === 'windows' ? windowsTasksOf(plan) : plan.tasks;
  for (const task of tasks) {
    const [project, target] = [task.slice(0, task.lastIndexOf(':')), task.split(':').at(-1)!];
    if (project === '*') {
      for (const [name, targets] of targetsByProject) {
        if (targets.has(target)) {
          want(name, target);
        }
      }
    } else if (targetsByProject.get(project)?.has(target)) {
      want(project, target);
    } else {
      // `run-many` would skip it silently.
      throw new Error(`The plan asks for ${task}, but Nx has no such task.`);
    }
  }

  const affectedCheck = env === 'linux' && plan.affectedCheck;
  if (affectedCheck && changedFiles.length > 0) {
    // From the changed files, not from a git range: the check then covers the diff the plan was
    // made from, and the main job needs only the commit that diff starts at.
    const affected: string[] = JSON.parse(
      yarn(
        ['nx', 'show', 'projects', '--affected', '--stdin', '--with-target', 'check', '--json'],
        changedFiles.join('\n')
      )
    );
    affected.forEach((project) => want(project, 'check'));
  }

  const groups = groupTasks(wanted, (project) => targetsByProject.get(project) ?? new Set());
  // The Windows tasks are the same for every workflow that has them, on the `ci:windows` projects.
  const pattern =
    groups.length !== 1
      ? undefined
      : env === 'windows'
        ? projectPattern(['windows'])
        : selected.includes('focus')
          ? undefined
          : projectPattern(selected);
  const commands = groups.map((group) =>
    commandFor({ targets: group.targets, projects: projectsOf(group, pattern, workspace) }, base)
  );

  const planned = [...wanted.values()].reduce((n, t) => n + t.size, 0);
  console.log(
    `${plan.jobs.length} CircleCI jobs → ${planned} NX tasks on ${env}${base ? `, of which Nx runs the ones a change since ${base} reaches,` : ''} in ${commands.length} command(s):`
  );
  for (const command of commands) {
    console.log(`  yarn ${command.join(' ')}`);
  }
  return commands;
}

async function main() {
  const { values } = parseArgs({
    options: {
      workflow: { type: 'string' },
      env: { type: 'string', default: 'linux' },
      base: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (values.env !== 'linux' && values.env !== 'windows') {
    throw new Error(`Unknown --env=${values.env}. Expected linux or windows.`);
  }
  const commands = nxCommands({
    selected: parseWorkflows(values.workflow ?? ''),
    env: values.env,
    base: values.base,
    changedFiles: changedFilesFromEnvironment(),
    workspace: cliWorkspace(),
  });
  if (values['dry-run'] || commands.length === 0) {
    return;
  }

  const codes = await Promise.all(
    commands.map(
      (command) =>
        new Promise<number>((resolve) => {
          spawn('yarn', command, {
            cwd: ROOT_DIRECTORY,
            stdio: 'inherit',
            shell: process.platform === 'win32',
          }).on('close', (code) => resolve(code ?? 1));
        })
    )
  );
  process.exitCode = codes.find((code) => code !== 0) ?? 0;
}

if (esMain(import.meta.url)) {
  await main();
}
