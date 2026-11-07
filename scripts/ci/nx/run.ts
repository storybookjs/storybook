// Run the NX tasks that cover a CircleCI workflow (see plan.ts) on NX Cloud. The commands run at
// the same time, in the same NX Cloud pipeline.
//
// Usage: run.ts --workflow=<workflows> [--env=linux|windows] [--base=<sha>] [--graph=<file>]
//               [--dry-run]
//
// - `--env=windows` runs the plan's Windows tasks instead of its Linux ones (circleci-dte.ts).
// - `--base` runs only the tasks a change since that commit reaches: `nx affected` with Nx's
//   task-level selection, which picks a task only when the diff touches one of its inputs.
//   Without it, every task of the plan runs (`nx run-many`).
// - `--graph` writes the tasks the commands would run (selection.ts) instead of running them.
//
// Focused runs read the changed files since `CI_CHANGED_FILES_BASE` (scripts/ci/utils/changed-files.ts).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { esMain } from '../../utils/esmain.ts';
import { changedFilesFromEnvironment } from '../utils/changed-files.ts';
import {
  type Group,
  groupTasks,
  parseWorkflows,
  planFor,
  projectPattern,
  windowsTasksOf,
} from './plan.ts';
import { type Selection, mergeTaskGraphs } from './selection.ts';

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

type ProjectGraph = { nodes: Record<string, { data: { targets?: Record<string, unknown> } }> };

function projectTargets() {
  const file = join(mkdtempSync(join(tmpdir(), 'nx-graph-')), 'graph.json');
  yarn(['nx', 'graph', `--file=${file}`]);
  const { graph } = JSON.parse(readFileSync(file, 'utf8')) as { graph: ProjectGraph };
  return new Map(
    Object.entries(graph.nodes).map(([name, node]) => [
      name,
      new Set(Object.keys(node.data.targets ?? {})),
    ])
  );
}

// The projects an Nx project pattern selects.
const matching = (pattern: string): string[] =>
  JSON.parse(yarn(['nx', 'show', 'projects', `--projects=${pattern}`, '--json']));

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
function projectsOf(
  group: Group,
  pattern: string | undefined,
  targetsByProject: ReadonlyMap<string, ReadonlySet<string>>
) {
  if (pattern) {
    const tagged = matching(pattern).filter((project) =>
      group.targets.some((target) => targetsByProject.get(project)?.has(target))
    );
    if (JSON.stringify(tagged.sort()) === JSON.stringify([...group.projects].sort())) {
      return pattern;
    }
    console.log(`${pattern} does not select exactly the planned projects; naming them instead.`);
  }
  return group.projects.join(',');
}

async function main() {
  const { values } = parseArgs({
    options: {
      workflow: { type: 'string' },
      env: { type: 'string', default: 'linux' },
      base: { type: 'string' },
      graph: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (values.env !== 'linux' && values.env !== 'windows') {
    throw new Error(`Unknown --env=${values.env}. Expected linux or windows.`);
  }
  const selected = parseWorkflows(values.workflow ?? '');
  const changedFiles = changedFilesFromEnvironment();
  const plan = planFor(selected, changedFiles);

  if (plan.missing.length > 0) {
    throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
  }

  const targetsByProject = projectTargets();
  const wanted = new Map<string, Set<string>>();
  const want = (project: string, target: string) =>
    wanted.set(project, (wanted.get(project) ?? new Set()).add(target));

  const tasks = values.env === 'windows' ? windowsTasksOf(plan) : plan.tasks;
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

  const affectedCheck = values.env === 'linux' && plan.affectedCheck;
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
      : values.env === 'windows'
        ? projectPattern(['windows'])
        : selected.includes('focus')
          ? undefined
          : projectPattern(selected);
  const commands = groups.map((group) =>
    commandFor(
      { targets: group.targets, projects: projectsOf(group, pattern, targetsByProject) },
      values.base
    )
  );

  const planned = [...wanted.values()].reduce((n, t) => n + t.size, 0);
  console.log(
    `${plan.jobs.length} CircleCI jobs → ${planned} NX tasks on ${values.env}${values.base ? `, of which Nx runs the ones a change since ${values.base} reaches,` : ''} in ${commands.length} command(s):`
  );
  for (const command of commands) {
    console.log(`  yarn ${command.join(' ')}`);
  }
  if (values['dry-run']) {
    return;
  }

  if (values.graph) {
    const directory = mkdtempSync(join(tmpdir(), 'nx-task-graph-'));
    const graphs = commands.map((command, i) => {
      const file = join(directory, `${i}.json`);
      yarn([...command, `--graph=${file}`]);
      return JSON.parse(readFileSync(file, 'utf8')).tasks;
    });
    const selection: Selection = mergeTaskGraphs(graphs);
    writeFileSync(values.graph, JSON.stringify(selection));
    console.log(`${Object.keys(selection.tasks).length} tasks to run → ${values.graph}`);
    return;
  }
  if (commands.length === 0) {
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
