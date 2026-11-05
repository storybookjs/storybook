import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { daily } from '../../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { executors } from '../utils/executors.ts';
import { workflows } from '../utils/types.ts';
import { equivalentOf, groupTasks, planFor } from './plan.ts';

const repoRoot = join(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

/** Diffs that, between them, reach every job a focused run can add. */
const focusDiffs = [
  ['code/renderers/vue3/src/index.ts'],
  ['code/core/template/stories/basics.stories.ts'],
  // A global input adds every path-triggered job and the full unit test suite.
  ['package.json'],
  ['code/lib/create-storybook/src/index.ts', 'code/addons/mcp/src/index.ts'],
  ['code/core/src/__tests__/fixtures/foo.json'],
];

const plans = [
  ...workflows.filter((w) => w !== 'focus').map((w) => planFor([w])),
  ...focusDiffs.map((diff) => planFor(['focus'], diff)),
];

const chromaticTokens = [
  ...new Set(
    plans.flatMap((plan) =>
      plan.tasks
        .filter((task) => task.endsWith(':chromatic'))
        .map(
          (task) =>
            `CHROMATIC_TOKEN_${task
              .slice(0, -':chromatic'.length)
              .toUpperCase()
              .replace(/\/|-|\./g, '_')}`
        )
    )
  ),
];

describe('the NX plan', () => {
  it.each(plans.map((plan, i) => [i, plan] as const))(
    'has an NX equivalent for every CircleCI job (plan %i)',
    (_, plan) => {
      expect(plan.missing).toEqual([]);
    }
  );

  it('maps a job it does not know to nothing, so the test above catches it', () => {
    expect(equivalentOf('some-new-circleci-job')).toBeUndefined();
  });

  it('runs the Windows and Node 26 jobs only where CircleCI does', () => {
    expect(planFor(['normal']).sideJobs).toEqual([]);
    expect(planFor(['daily']).sideJobs).toEqual(['windows', 'windows-init-empty', 'node-26-smoke']);
    expect(planFor(['windows']).sideJobs).toEqual(['windows']);
  });

  it('runs the Windows sandbox jobs on the sandbox CircleCI uses', () => {
    const workflow = read('.github/workflows/nx.yml');

    const windowsJob = workflow.slice(
      workflow.indexOf('\n  windows:\n'),
      workflow.indexOf('\n  node-26-smoke:\n')
    );

    expect(windowsJob).toContain(`      TEMPLATE: ${daily[0]}\n`);
    expect(windowsJob).not.toMatch(/--template (?!"\$TEMPLATE")/);
  });

  it('passes every Chromatic token a plan needs to the NX Cloud workers', () => {
    const workflow = read('.github/workflows/nx.yml');
    const ciConfig = read('.nx/ci-config.yaml');

    expect(chromaticTokens.length).toBeGreaterThan(10);
    for (const token of chromaticTokens) {
      expect(workflow).toContain(`${token}: \${{ secrets.${token} }}`);
      expect(ciConfig).toContain(`- ${token}\n`);
    }
  });

  it('forwards the changed files and their count to the NX Cloud workers', () => {
    const ciConfig = read('.nx/ci-config.yaml');

    expect(ciConfig).toContain('- CI_CHANGED_FILES\n');
    expect(ciConfig).toContain('- CI_CHANGED_FILES_COUNT\n');
  });

  it('starts on the same ci: labels as CircleCI', () => {
    const labels = JSON.stringify(workflows.map((workflow) => `ci:${workflow}`).sort());
    const lists = [...read('.github/workflows/nx.yml').matchAll(/fromJSON\('(\[[^\]]*\])'\)/g)].map(
      ([, list]) => JSON.stringify(JSON.parse(list).sort())
    );
    const contains = [
      ...read('.github/workflows/nx.yml').matchAll(/labels\.\*\.name, '(ci:\w+)'\)/g),
    ].map(([, label]) => label);

    expect(lists.length).toBeGreaterThanOrEqual(2);
    expect(lists.every((list) => list === labels)).toBe(true);
    expect(JSON.stringify(contains.sort())).toBe(labels);
    const circleList = read('.github/workflows/trigger-circle-ci-workflow.yml').match(
      /select\(IN\(([^)]*)\)\)/
    )?.[1];
    expect(
      JSON.stringify(
        JSON.parse(`[${circleList}]`)
          .map((w: string) => `ci:${w}`)
          .sort()
      )
    ).toBe(labels);
  });

  it('runs the Node 26 smoke job on the Node version CircleCI uses', () => {
    const image = executors.sb_node_26.docker[0].image;
    const version = image.split(':')[1];

    expect(read('.github/workflows/nx.yml')).toContain(`node-version: ${version}\n`);
  });
});

describe('groupTasks', () => {
  const targets: Record<string, string[]> = {
    core: ['compile', 'check'],
    sandboxA: ['sandbox', 'build', 'chromatic', 'e2e-tests', 'dev'],
    sandboxB: ['sandbox', 'build', 'chromatic', 'e2e-tests', 'dev'],
  };
  const targetsOf = (project: string) => new Set(targets[project]);

  it('runs everything in one command when that runs nothing extra', () => {
    const wanted = new Map([
      ['core', new Set(['compile', 'check'])],
      ['sandboxA', new Set(['sandbox', 'build', 'chromatic', 'e2e-tests'])],
    ]);

    expect(groupTasks(wanted, targetsOf)).toEqual([
      {
        targets: ['build', 'check', 'chromatic', 'compile', 'e2e-tests', 'sandbox'],
        projects: ['core', 'sandboxA'],
      },
    ]);
  });

  it('gives a project its own command when the shared one would run more of its targets', () => {
    const wanted = new Map([
      ['sandboxA', new Set(['sandbox', 'build', 'chromatic', 'e2e-tests'])],
      ['sandboxB', new Set(['chromatic'])],
    ]);

    expect(groupTasks(wanted, targetsOf)).toEqual([
      { targets: ['build', 'chromatic', 'e2e-tests', 'sandbox'], projects: ['sandboxA'] },
      { targets: ['chromatic'], projects: ['sandboxB'] },
    ]);
  });
});
