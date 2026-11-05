/**
 * Run the NX tasks that cover a CircleCI workflow (see plan.ts) on NX Cloud. The commands run at
 * the same time, in the same NX Cloud pipeline.
 *
 * Usage: run.ts --workflow=<workflows> [--dry-run]
 * Focused runs read the changed files from `CI_CHANGED_FILES`, one per line.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { groupTasks, parseWorkflows, planFor } from './plan.ts';

function yarn(args: string[]) {
  const result = spawnSync('yarn', args, { cwd: ROOT_DIRECTORY, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`yarn ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

function projectTargets() {
  const file = join(mkdtempSync(join(tmpdir(), 'nx-graph-')), 'graph.json');
  yarn(['nx', 'graph', `--file=${file}`]);
  const { graph } = JSON.parse(readFileSync(file, 'utf8')) as {
    graph: { nodes: Record<string, { data: { targets?: Record<string, unknown> } }> };
  };
  return new Map(
    Object.entries(graph.nodes).map(([name, node]) => [
      name,
      new Set(Object.keys(node.data.targets ?? {})),
    ])
  );
}

async function main() {
  const { values } = parseArgs({
    options: {
      workflow: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const changedFiles = (process.env.CI_CHANGED_FILES ?? '').split('\n').filter(Boolean);
  const plan = planFor(parseWorkflows(values.workflow ?? ''), changedFiles);

  if (plan.missing.length > 0) {
    throw new Error(`No NX equivalent for the CircleCI jobs: ${plan.missing.join(', ')}`);
  }

  const targetsByProject = projectTargets();
  const wanted = new Map<string, Set<string>>();
  const want = (project: string, target: string) =>
    wanted.set(project, (wanted.get(project) ?? new Set()).add(target));

  for (const task of plan.tasks) {
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

  if (plan.affectedCheck) {
    const affected: string[] = JSON.parse(
      yarn(['nx', 'show', 'projects', '--affected', '--with-target', 'check', '--json'])
    );
    affected.forEach((project) => want(project, 'check'));
  }

  const groups = groupTasks(wanted, (project) => targetsByProject.get(project) ?? new Set());
  const commands = groups.map(({ targets, projects }) => [
    'nx',
    'run-many',
    `--targets=${targets.join(',')}`,
    `--projects=${projects.join(',')}`,
    '--configuration=production',
  ]);

  console.log(
    `${plan.jobs.length} CircleCI jobs → ${[...wanted.values()].reduce((n, t) => n + t.size, 0)} NX tasks in ${commands.length} command(s):`
  );
  for (const command of commands) {
    console.log(`  yarn ${command.join(' ')}`);
  }
  if (values['dry-run'] || commands.length === 0) {
    return;
  }

  // nx.yml completes the task names that Nx's summary table cuts off from this list.
  if (process.env.RUNNER_TEMP) {
    const taskIds = [...wanted].flatMap(([project, targets]) =>
      [...targets].map((target) => `${project}:${target}:production`)
    );
    writeFileSync(join(process.env.RUNNER_TEMP, 'nx-tasks.json'), JSON.stringify(taskIds));
  }

  const codes = await Promise.all(
    commands.map(
      (command) =>
        new Promise<number>((resolve) => {
          spawn('yarn', command, { cwd: ROOT_DIRECTORY, stdio: 'inherit' }).on('close', (code) =>
            resolve(code ?? 1)
          );
        })
    )
  );
  process.exitCode = codes.find((code) => code !== 0) ?? 0;
}

await main();
