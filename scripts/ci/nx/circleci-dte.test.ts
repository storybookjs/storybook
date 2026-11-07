import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { describe, expect, it, onTestFinished } from 'vitest';

import { parameters } from '../utils/parameters.ts';
import { workflows } from '../utils/types.ts';
import {
  CHECK_CHECKOUT_STEP,
  HASH_MANIFESTS_COMMAND,
  LAUNCH_TEMPLATES,
  MANIFESTS_SUM,
  NODE_MODULES_ARCHIVE,
  NODE_MODULES_KEY,
  getNxDteJobs,
} from './circleci-dte.ts';
import { MAX_AGENTS } from './agent-sizing.ts';
import { hasEnded } from './main-job-ended.ts';
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
    expect(ids('windows')).toEqual(windows);
  });

  const tasks = (target: string, n: number): Selection => ({
    tasks: Object.fromEntries(
      Array.from({ length: n }, (_, i) => [
        `p${i}:${target}`,
        { project: `p${i}`, target, cache: true, dependsOn: [] },
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

  it('starts the agents the setup job worked out, all in one job', () => {
    const jobs = getNxDteJobs(['daily'], 'unused', {
      selection: { linux: tasks('fmt', 1), windows: tasks('test-1', 1) },
      agents: { linux: 3, windows: 2 },
    });
    expect(job(jobs, 'nx-agent')!.parallelism).toBe(3);
    expect(job(jobs, 'nx-main')!.environment.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT).toBe('3');
    expect(job(jobs, 'nx-agent-windows')!.parallelism).toBe(2);
    expect(
      job(jobs, 'nx-main-windows')!.environment.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT
    ).toBe('2');
  });

  it('names every target of the command in --stop-workers-after, whatever the change reaches', () => {
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
    for (const id of ['nx-main', 'nx-main-windows']) {
      const commands = job(jobs, id)!.steps.map((step) => step.run?.command ?? '');
      expect(
        commands.some((command) => /\/usr\/bin\/timeout --kill-after=1m \d+m yarn /.test(command))
      ).toBe(true);
    }
  });

  it('stops each agent once its main job has ended, also when that never started the NX Cloud run', () => {
    const jobs = withSelection(tasks('fmt', 1), tasks('test-1', 1));
    for (const [agent, main] of [
      ['nx-agent', 'nx-main'],
      ['nx-agent-windows', 'nx-main-windows'],
    ]) {
      const commands = job(jobs, agent)!.steps.map((step) => step.run?.command ?? '');
      expect(
        commands.some((command) => / scripts\/ci\/nx\/run-agent\.sh \S+ \d+$/.test(command))
      ).toBe(true);
      expect(commands.some((command) => command.includes(`run-agent.sh ${main} `))).toBe(true);
    }
  });

  it('counts a main job as ended once CircleCI no longer runs it', () => {
    const jobs = (status: string) => [
      { name: 'nx-agent', status: 'running' },
      { name: 'nx-main', status },
    ];
    for (const status of ['success', 'failed', 'canceled', 'infrastructure_fail', 'timedout']) {
      expect(hasEnded(jobs(status), 'nx-main')).toBe(true);
    }
    for (const status of ['running', 'queued', 'not_running', 'blocked', 'on_hold']) {
      expect(hasEnded(jobs(status), 'nx-main')).toBe(false);
    }
    expect(hasEnded(jobs('success'), 'nx-main-windows')).toBe(false);
  });

  it('lists, as the last step of each agent, what its tasks left in the checkout, without failing', () => {
    const jobs = withSelection(tasks('fmt', 1), tasks('test-1', 1));
    for (const id of ['nx-agent', 'nx-agent-windows']) {
      const last = job(jobs, id)!.steps.at(-1)!.run as {
        name: string;
        when: string;
        command: string;
      };
      expect(last.name).toBe(CHECK_CHECKOUT_STEP);
      expect(last.when).toBe('always');

      const repo = mkdtempSync(join(tmpdir(), 'agent-checkout-'));
      onTestFinished(() => rmSync(repo, { recursive: true, force: true }));
      const git = (...args: string[]) => spawnSync('git', args, { cwd: repo });
      git('init', '--quiet');
      writeFileSync(join(repo, '.gitignore'), 'sandbox\n');
      git('add', '.');
      git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '--quiet', '-m', 'i');
      const check = () => spawnSync('bash', ['-c', last.command], { cwd: repo, encoding: 'utf8' });

      mkdirSync(join(repo, 'sandbox'));
      writeFileSync(join(repo, 'sandbox', 'chromatic-diagnostics.json'), '{}');
      expect(check().status).toBe(0);

      writeFileSync(join(repo, 'chromatic-diagnostics.json'), '{}');
      const dirty = check();
      expect(dirty.status).toBe(0);
      expect(dirty.stdout).toContain('?? chromatic-diagnostics.json');
    }
  });

  it('keys node_modules on the patches, whose install a hit would skip, also when there are none', () => {
    const repo = mkdtempSync(join(tmpdir(), 'node-modules-key-'));
    onTestFinished(() => rmSync(repo, { recursive: true, force: true }));
    mkdirSync(join(repo, '.yarn/patches'), { recursive: true });
    writeFileSync(join(repo, 'package.json'), '{}');
    const sum = join(repo, 'manifests.sha256');
    // As CircleCI runs a step.
    const hash = () => {
      const result = spawnSync(
        'bash',
        [
          '-eo',
          'pipefail',
          '-c',
          HASH_MANIFESTS_COMMAND.replace(MANIFESTS_SUM, 'manifests.sha256'),
        ],
        { cwd: repo, encoding: 'utf8' }
      );
      expect(result.status, result.stderr).toBe(0);
      return readFileSync(sum, 'utf8');
    };

    const withoutPatches = hash();
    writeFileSync(join(repo, '.yarn/patches/pkg-npm-1.0.0.patch'), '+ one');
    expect(hash()).not.toBe(withoutPatches);
    const before = hash();
    writeFileSync(join(repo, '.yarn/patches/pkg-npm-1.0.0.patch'), '+ two');

    expect(hash()).not.toBe(before);
  });

  it('restores and saves node_modules in the setup job under the key the NX jobs use', () => {
    const config = read('.circleci/config.yml');
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
  }, 30_000);

  it('starts every agent job at its maximum without a selection from the setup job', () => {
    const jobs = getNxDteJobs(['daily'], 'unused');
    expect(job(jobs, 'nx-agent')!.parallelism).toBe(MAX_AGENTS.linux);
    expect(job(jobs, 'nx-agent-windows')!.parallelism).toBe(MAX_AGENTS.windows);
    const capped = getNxDteJobs(['normal'], 'unused', { maxAgents: 7 });
    expect(job(capped, 'nx-agent')!.parallelism).toBe(7);
  });

  it('keeps a job in a windows workflow, which has no Linux part or completion job, when the change reaches no task', () => {
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
  }, 30_000);

  it('starts on the same workflows as the ci: labels', () => {
    const list = read('.github/workflows/trigger-circleci-nx-dte.yml').match(
      /select\(IN\(([^)]*)\)\)/
    )?.[1];

    expect(JSON.parse(`[${list}]`).sort()).toEqual([...workflows].sort());
  });
});
