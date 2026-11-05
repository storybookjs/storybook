import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { parameters } from '../utils/parameters.ts';
import { workflows } from '../utils/types.ts';
import { NX_DTE_AGENTS, getNxDteJobs } from './circleci-dte.ts';

const repoRoot = join(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

const ids = (workflow: (typeof workflows)[number]) =>
  getNxDteJobs([workflow], 'unused').map((job) => job.id);

describe('the CircleCI NX DTE pipeline', () => {
  it('runs every Linux task on the agents, and only the side jobs as CircleCI jobs', () => {
    expect(ids('normal')).toEqual(['nx-main', 'nx-agent']);
    expect(ids('daily')).toEqual([
      'nx-main',
      'nx-agent',
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
      for (const job of getNxDteJobs([workflow], 'unused')) {
        expect(job.requires).toEqual([]);
      }
    }
  });

  it('runs the default number of agents, with the agent the assignment rules name', () => {
    const agent = getNxDteJobs(['normal'], 'unused')
      .find((job) => job.id === 'nx-agent')!
      .implementation('normal') as { parallelism: number; environment: Record<string, string> };
    const template = agent.environment.NX_AGENT_LAUNCH_TEMPLATE;

    expect(agent.parallelism).toBe(NX_DTE_AGENTS);
    expect(parameters.nxDteAgents.default).toBe(NX_DTE_AGENTS);
    expect(read('.circleci/config.yml')).toContain(`nxDteAgents:\n    default: ${NX_DTE_AGENTS}\n`);
    expect(read('.nx/workflows/circleci-assignment-rules.yaml')).toContain(`agent: ${template}\n`);
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
