import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { parameters } from '../utils/parameters.ts';
import { workflows } from '../utils/types.ts';
import { NX_DTE_AGENTS, getNxDteJobs } from './circleci-dte.ts';

const repoRoot = join(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

const ids = (workflow: (typeof workflows)[number]) =>
  getNxDteJobs([workflow], 'unused').map((job) => job.id);

describe('the CircleCI NX DTE pipeline', () => {
  it('runs every Linux task on the agents, and only the side jobs as CircleCI jobs', () => {
    const agents = [
      'nx-main',
      'nx-agent',
      'nx-agent-sandbox',
      'nx-agent-peak-delay',
      'nx-agent-peak',
    ];
    expect(ids('normal')).toEqual(agents);
    expect(ids('daily')).toEqual([
      ...agents,
      'windows--unit-1',
      'windows--unit-2',
      'windows--e2e-build',
      'windows--e2e-dev',
      'windows--init-empty',
      'node-26-smoke',
    ]);
  });

  it('needs no job outside the pipeline', () => {
    for (const workflow of workflows.filter((w) => w !== 'focus')) {
      const jobs = getNxDteJobs([workflow], 'unused');
      for (const job of jobs) {
        expect(job.requires.every((required) => jobs.includes(required))).toBe(true);
      }
    }
  });

  it('runs each agent job with its default number of agents, in a pool the assignment rules name', () => {
    const jobs = getNxDteJobs(['normal'], 'unused');
    const parameterOf = {
      general: 'nxDteAgents',
      sandbox: 'nxDteSandboxAgents',
      peak: 'nxDtePeakAgents',
    };
    for (const [kind, { job, agents, template }] of Object.entries(NX_DTE_AGENTS)) {
      const agent = jobs.find((j) => j.id === job)!.implementation('normal') as {
        parallelism: number;
        environment: Record<string, string>;
      };
      expect(agent.parallelism).toBe(agents);
      expect(agent.environment.NX_AGENT_LAUNCH_TEMPLATE).toBe(template);
      const parameter = parameterOf[kind as keyof typeof parameterOf];
      expect(parameters[parameter].default).toBe(agents);
      expect(read('.circleci/config.yml')).toContain(`${parameter}:\n    default: ${agents}\n`);
    }
    expect(jobs.find((j) => j.id === 'nx-agent-peak')!.requires.map((j) => j.id)).toEqual([
      'nx-agent-peak-delay',
    ]);
  });

  it("sends a sandbox's own tasks to the sandbox pool and the others to the general one", () => {
    type Rule = { targets: string[]; 'run-on': { agent: string }[] };
    const rules: Rule[] = parse(read('.nx/workflows/circleci-assignment-rules.yaml'))[
      'assignment-rules'
    ];
    // Every rule matches on targets only, so NX Cloud applies the first that matches.
    expect(rules.every((rule) => Object.keys(rule).sort().join() === 'run-on,targets')).toBe(true);
    const glob = (pattern: string) =>
      new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`);
    const poolsOf = (target: string) =>
      rules
        .find((rule) => rule.targets.some((pattern) => glob(pattern).test(target)))!
        ['run-on'].map(({ agent }) =>
          agent === NX_DTE_AGENTS.sandbox.template
            ? 'sandbox'
            : agent === NX_DTE_AGENTS.general.template
              ? 'general'
              : agent
        )
        .sort();

    for (const target of [
      'sandbox',
      'build',
      'dev',
      'serve',
      'e2e-tests',
      'e2e-tests-dev-3',
      'chromatic',
      'vitest-integration',
    ]) {
      expect(poolsOf(target)).toEqual(['sandbox']);
    }
    for (const target of ['check', 'lint', 'test-1', 'e2e-internal-1', 'e2e-ui-1', 'init-empty']) {
      expect(poolsOf(target)).toEqual(['general']);
    }
    for (const target of ['compile', 'publish', 'run-registry']) {
      expect(poolsOf(target)).toEqual(['general', 'sandbox']);
    }
    expect(NX_DTE_AGENTS.peak.template).toBe(NX_DTE_AGENTS.sandbox.template);
  });

  it('is generated only when the pipeline asks for it', () => {
    const generate = (...args: string[]) =>
      spawnSync(
        process.execPath,
        ['--experimental-transform-types', './scripts/ci/main.ts', '--workflow=normal', ...args],
        { cwd: repoRoot, encoding: 'utf8' }
      );
    const workflowName = () =>
      Object.keys(JSON.parse(read('.circleci/config.generated.yml')).workflows)[0];

    expect(generate('--nx-dte=true').status).toBe(0);
    expect(workflowName()).toBe('normal-nx-dte-generated');
    expect(generate('--nx-dte=false').status).toBe(0);
    expect(workflowName()).toBe('normal-generated');
  });

  it('starts on the same workflows as the ci: labels', () => {
    const list = read('.github/workflows/trigger-circleci-nx-dte.yml').match(
      /select\(IN\(([^)]*)\)\)/
    )?.[1];

    expect(JSON.parse(`[${list}]`).sort()).toEqual([...workflows].sort());
  });
});
