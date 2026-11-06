import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { parameters } from '../utils/parameters.ts';
import { workflows } from '../utils/types.ts';
import {
  MEASURE_WITHOUT_WINDOWS,
  NX_DTE_MODE,
  NX_DTE_WAVES,
  agentsFor,
  getNxDteJobs,
} from './circleci-dte.ts';

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
  it('runs every Linux task on the agents, and only the side jobs as CircleCI jobs', () => {
    const agents = ['nx-main', 'nx-agent', 'nx-agent-peak-delay', 'nx-agent-peak'];
    expect(ids('normal')).toEqual(agents);
    expect(ids('daily')).toEqual([
      ...agents,
      ...(MEASURE_WITHOUT_WINDOWS
        ? []
        : [
            'windows--unit-1',
            'windows--unit-2',
            'windows--e2e-build',
            'windows--e2e-dev',
            'windows--init-empty',
          ]),
      'node-26-smoke',
    ]);
  });

  it('sizes the waves to the plan', () => {
    const sandboxes = (n: number) =>
      Array.from({ length: n }, (_, i) => [`t${i}:sandbox`, `t${i}:e2e-tests`]).flat();
    const plan = (tasks: string[], affectedCheck = false) => ({ tasks, affectedCheck });

    // No more first-wave agents than tasks, unless they expand in Nx.
    expect(agentsFor(plan(['code:fmt']))).toEqual({ first: 1, peak: 0 });
    expect(agentsFor(plan(['*:compile']))).toEqual({ first: 20, peak: 0 });
    expect(agentsFor(plan(['code:fmt'], true))).toEqual({ first: 20, peak: 0 });
    // Three tasks per sandbox at the peak, minus the first wave, capped at the default.
    expect(agentsFor(plan(['*:compile', ...sandboxes(4)]))).toEqual({ first: 20, peak: 0 });
    expect(agentsFor(plan(['*:compile', ...sandboxes(10)]))).toEqual({ first: 20, peak: 10 });
    expect(agentsFor(plan(['*:compile', ...sandboxes(16)]))).toEqual({ first: 20, peak: 24 });
    expect(agentsFor(plan(['*:compile', ...sandboxes(16)]), { peak: 0 })).toEqual({
      first: 20,
      peak: 0,
    });
  });

  it('leaves the agents out of circleci-completion', () => {
    const { workflows: generated } = generateConfig('--workflow=normal', '--nx-dte=true');
    const completion = Object.values(generated)
      .flatMap((workflow) => (workflow as { jobs: unknown[] }).jobs)
      .find((job) => typeof job === 'object' && job !== null && 'circleci-completion' in job) as {
      'circleci-completion': { requires: string[] };
    };
    expect(completion['circleci-completion'].requires).toEqual(['nx-main']);
  });

  it('adds peak agents only for what the first wave cannot take', () => {
    // docs creates no sandbox; normal creates 16, three tasks each at the peak, minus the 20 of
    // the first wave, capped at the default.
    expect(ids('docs')).toEqual(['nx-main', 'nx-agent']);
    const docsAgent = getNxDteJobs(['docs'], 'unused').find((job) => job.id === 'nx-agent')!;
    expect((docsAgent.implementation('docs') as { parallelism: number }).parallelism).toBe(1);
    const peak = getNxDteJobs(['normal'], 'unused').find((job) => job.id === 'nx-agent-peak')!;
    // The mix sizes its large wave to the tasks only it runs (4 internal + 22 dev-server E2E).
    expect((peak.implementation('normal') as { parallelism: number }).parallelism).toBe(
      NX_DTE_MODE === 'mix' ? 26 : 24
    );
  });

  it('needs no job outside the pipeline', () => {
    for (const workflow of workflows.filter((w) => w !== 'focus')) {
      const jobs = getNxDteJobs([workflow], 'unused');
      for (const job of jobs) {
        expect(job.requires.every((required) => jobs.includes(required))).toBe(true);
      }
    }
  });

  it('runs each wave with its default number of agents, as the agent the assignment rules name', () => {
    const jobs = getNxDteJobs(['normal'], 'unused');
    for (const [wave, { job, agents }] of Object.entries(NX_DTE_WAVES)) {
      const agent = jobs.find((j) => j.id === job)!.implementation('normal') as {
        parallelism: number;
        environment: Record<string, string>;
      };
      if (NX_DTE_MODE !== 'mix' || wave === 'first') {
        expect(agent.parallelism).toBe(agents);
      }
      const rules = `.nx/workflows/circleci-assignment-rules${NX_DTE_MODE === 'mix' ? '-mix' : ''}.yaml`;
      expect(read(rules)).toContain(`agent: ${agent.environment.NX_AGENT_LAUNCH_TEMPLATE}\n`);
      const parameter = wave === 'first' ? 'nxDteAgents' : 'nxDtePeakAgents';
      expect(parameters[parameter].default).toBe(agents);
      expect(read('.circleci/config.yml')).toContain(`${parameter}:\n    default: ${agents}\n`);
    }
    expect(jobs.find((j) => j.id === 'nx-agent-peak')!.requires.map((j) => j.id)).toEqual([
      'nx-agent-peak-delay',
    ]);
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
