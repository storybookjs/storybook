import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { parameters } from '../utils/parameters.ts';
import { workflows } from '../utils/types.ts';
import {
  HASH_MANIFESTS_COMMAND,
  LAUNCH_TEMPLATES,
  NODE_MODULES_ARCHIVE,
  NODE_MODULES_KEY,
  MAX_AGENTS,
  agentsForSelection,
  getNxDteJobs,
} from './circleci-dte.ts';
import { planFor } from './plan.ts';
import { EMPTY_SELECTION, type Selection } from './selection.ts';

const repoRoot = join(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

// Each run writes its own file: test files run in parallel, and main.test.ts generates too.
const generateConfig = (...args: string[]) => {
  const output = join(mkdtempSync(join(tmpdir(), 'circleci-config-')), 'config.yml');
  const result = spawnSync(
    process.execPath,
    ['--experimental-transform-types', './scripts/ci/main.ts', ...args, `--output=${output}`],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(readFileSync(output, 'utf8'));
};

const ids = (workflow: (typeof workflows)[number]) =>
  getNxDteJobs([workflow], 'unused').map((job) => job.id);

describe('the CircleCI NX DTE pipeline', () => {
  it('runs every task on NX agents, and only the Node 26 smoke job as a CircleCI job', () => {
    const agents = ['nx-main', 'nx-agent'];
    const windows = ['nx-main-windows', 'nx-agent-windows'];
    expect(ids('normal')).toEqual(agents);
    expect(ids('daily')).toEqual([...agents, ...windows, 'node-26-smoke']);
    // Its Linux tasks only feed CircleCI's own Windows jobs.
    expect(ids('windows')).toEqual(windows);
  });

  // A selection of `n` independent tasks of a target, each taking `seconds`.
  const tasks = (target: string, n: number, seconds = 60, cached = false): Selection => ({
    tasks: Object.fromEntries(
      Array.from({ length: n }, (_, i) => [
        `p${i}:${target}`,
        { project: `p${i}`, target, cache: true, dependsOn: [], seconds, cached },
      ])
    ),
  });
  const withSelection = (linux: Selection, windows: Selection = EMPTY_SELECTION, base?: string) =>
    getNxDteJobs(['daily'], 'unused', { base, selection: { linux, windows } });
  const job = (jobs: ReturnType<typeof getNxDteJobs>, id: string) =>
    jobs.find((j) => j.id === id)?.implementation('daily') as
      | {
          parallelism?: number;
          environment: Record<string, string>;
          steps: { run?: { name: string; command: string } }[];
        }
      | undefined;

  it('starts the agents the work needs, all at once', () => {
    expect(agentsForSelection(tasks('fmt', 1), 'linux')).toBe(1);
    // A rerun: the same tasks, but they only restore from the cache.
    expect(agentsForSelection(tasks('e2e-tests', 177, 5, true), 'linux')).toBeLessThan(10);
    expect(agentsForSelection(tasks('e2e-tests', 177), 'linux')).toBeGreaterThan(20);
    expect(agentsForSelection(tasks('e2e-tests', 440, 300), 'linux')).toBe(MAX_AGENTS.linux);
    expect(agentsForSelection(tasks('e2e-tests', 440, 300), 'linux', 5)).toBe(5);
    expect(agentsForSelection(EMPTY_SELECTION, 'linux')).toBe(0);

    const jobs = withSelection(tasks('fmt', 1));
    expect(job(jobs, 'nx-agent')!.parallelism).toBe(1);
    expect(job(jobs, 'nx-main')!.environment.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT).toBe('1');
  });

  it('starts at most four Windows agents, which take about four minutes to boot', () => {
    expect(agentsForSelection(tasks('e2e-tests', 2, 600), 'windows')).toBe(2);
    expect(agentsForSelection(tasks('e2e-tests', 40, 600), 'windows')).toBe(MAX_AGENTS.windows);
  });

  it('names every target of the command in --stop-workers-after, whatever the change reaches', () => {
    // NX Cloud stops an agent early only once every target of the command is accounted for.
    const start = job(withSelection(tasks('fmt', 1)), 'nx-main')!.steps.find(
      (step) => step.run?.name === 'Start the NX Cloud run'
    )!.run!.command;
    const targets = start.match(/--stop-workers-after=(\S+)/)![1].split(',');
    expect(targets).toEqual(
      [...new Set(planFor(['daily']).tasks.map((task) => task.split(':').at(-1)))].sort()
    );
    expect(targets).toContain('dedupe-check');
  });

  it('starts no NX job for an OS with nothing to run', () => {
    const ids = withSelection(EMPTY_SELECTION, EMPTY_SELECTION).map((j) => j.id);
    expect(ids).toEqual(['node-26-smoke']);
    expect(withSelection(tasks('fmt', 1)).map((j) => j.id)).not.toContain('nx-main-windows');
  });

  it('runs nx affected against the base the setup job found, on both OSes', () => {
    const base = 'abc123';
    const jobs = withSelection(tasks('fmt', 1), tasks('test-1', 1), base);
    for (const main of ['nx-main', 'nx-main-windows']) {
      const steps = job(jobs, main)!.steps.map((step) => step.run);
      expect(steps.find((run) => run?.name === 'Run nx')!.command).toContain(`--base=${base}`);
      expect(steps.find((run) => run?.name?.startsWith('Fetch the commit'))!.command).toContain(
        base
      );
    }
    const noBase = job(withSelection(tasks('fmt', 1)), 'nx-main')!.steps.map((step) => step.run);
    expect(noBase.find((run) => run?.name === 'Run nx')!.command).not.toContain('--base');
  });

  it('keeps the Linux and the Windows run apart, each with its own agents', () => {
    const jobs = withSelection(tasks('fmt', 1), tasks('test-1', 1));
    for (const [os, main, agent] of [
      ['linux', 'nx-main', 'nx-agent'],
      ['windows', 'nx-main-windows', 'nx-agent-windows'],
    ] as const) {
      expect(job(jobs, main)!.environment.NX_CI_EXECUTION_ENV).toBe(os);
      expect(job(jobs, agent)!.environment.NX_CI_EXECUTION_ENV).toBe(os);
      expect(job(jobs, agent)!.environment.NX_AGENT_LAUNCH_TEMPLATE).toBe(LAUNCH_TEMPLATES[os]);
      const rules = os === 'linux' ? 'circleci' : 'circleci-windows';
      expect(read(`.nx/workflows/${rules}-assignment-rules.yaml`)).toContain(
        `agent: ${LAUNCH_TEMPLATES[os]}\n`
      );
      expect(
        job(jobs, main)!.steps.find((step) => step.run?.name === 'Start the NX Cloud run')!.run!
          .command
      ).toContain(`--assignment-rules=.nx/workflows/${rules}-assignment-rules.yaml`);
    }
  });

  it('bounds every NX job, so a run that never ends cannot hold machines for hours', () => {
    const jobs = withSelection(tasks('fmt', 1), tasks('test-1', 1));
    for (const id of ['nx-main', 'nx-agent', 'nx-main-windows', 'nx-agent-windows']) {
      const commands = job(jobs, id)!.steps.map((step) => step.run?.command ?? '');
      expect(
        commands.some((command) => /\/usr\/bin\/timeout --kill-after=1m \d+m yarn /.test(command))
      ).toBe(true);
    }
  });

  it('restores node_modules in the setup job from the key the NX jobs use', () => {
    const config = read('.circleci/config.yml');
    // Restored and saved there.
    expect(config.split(NODE_MODULES_KEY).length - 1).toBe(2);
    expect(config).toContain(`command: ${HASH_MANIFESTS_COMMAND}\n`);
    expect(config).toContain(`restore ${NODE_MODULES_ARCHIVE}\n`);
  });

  it('leaves the agents out of circleci-completion', () => {
    const { workflows: generated } = generateConfig('--workflow=normal', '--nx-dte=true');
    const completion = Object.values(generated)
      .flatMap((workflow) => (workflow as { jobs: unknown[] }).jobs)
      .find((job) => typeof job === 'object' && job !== null && 'circleci-completion' in job) as {
      'circleci-completion': { requires: string[] };
    };
    expect(completion['circleci-completion'].requires).toEqual(['nx-main']);
    const daily = Object.values(generateConfig('--workflow=daily', '--nx-dte=true').workflows)
      .flatMap((workflow) => (workflow as { jobs: unknown[] }).jobs)
      .find((job) => typeof job === 'object' && job !== null && 'circleci-completion' in job) as {
      'circleci-completion': { requires: string[] };
    };
    expect(daily['circleci-completion'].requires.sort()).toEqual(
      ['nx-main', 'nx-main-windows', 'node-26-smoke'].sort()
    );
  });

  it('starts every agent job at its maximum without a selection from the setup job', () => {
    const jobs = getNxDteJobs(['daily'], 'unused');
    expect(job(jobs, 'nx-agent')!.parallelism).toBe(MAX_AGENTS.linux);
    expect(job(jobs, 'nx-agent-windows')!.parallelism).toBe(MAX_AGENTS.windows);
    const capped = getNxDteJobs(['normal'], 'unused', { maxAgents: 7 });
    expect(job(capped, 'nx-agent')!.parallelism).toBe(7);
  });

  it('keeps a job in the workflow when the change reaches no task', () => {
    // A `windows` run has no Linux part and no completion job.
    const jobs = getNxDteJobs(['windows'], 'unused', {
      selection: { linux: EMPTY_SELECTION, windows: EMPTY_SELECTION },
    });
    expect(jobs.map((job) => job.id)).toEqual(['nx-nothing-to-run']);
  });

  it('needs no job outside the pipeline', () => {
    for (const workflow of workflows.filter((w) => w !== 'focus')) {
      const jobs = getNxDteJobs([workflow], 'unused');
      for (const job of jobs) {
        expect(job.requires.every((required) => jobs.includes(required))).toBe(true);
      }
    }
  });

  it('runs the agents as the agent the assignment rules name, at most as many as the parameter says', () => {
    const agent = job(getNxDteJobs(['normal'], 'unused'), 'nx-agent')!;
    expect(read('.nx/workflows/circleci-assignment-rules.yaml')).toContain(
      `agent: ${agent.environment.NX_AGENT_LAUNCH_TEMPLATE}\n`
    );
    expect(parameters.nxDteMaxAgents.default).toBe(MAX_AGENTS.linux);
    expect(read('.circleci/config.yml')).toContain(
      `nxDteMaxAgents:\n    default: ${MAX_AGENTS.linux}\n`
    );
  });

  it('is generated only when the pipeline asks for it', () => {
    const workflowName = (...args: string[]) =>
      Object.keys(generateConfig('--workflow=normal', ...args).workflows)[0];

    expect(workflowName('--nx-dte=true')).toBe('normal-nx-dte-generated');
    expect(workflowName('--nx-dte=false')).toBe('normal-generated');
  });

  it('starts on the same workflows as the ci: labels', () => {
    const list = read('.github/workflows/trigger-circleci-nx-dte.yml').match(
      /select\(IN\(([^)]*)\)\)/
    )?.[1];

    expect(JSON.parse(`[${list}]`).sort()).toEqual([...workflows].sort());
  });
});
