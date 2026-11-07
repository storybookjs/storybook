import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { daily } from '../../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { workflows } from '../utils/types.ts';
import { equivalentOf, groupTasks, planFor } from './plan.ts';

const repoRoot = join(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');

// Diffs that, between them, reach every job a focused run can add.
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

  it('creates every sandbox of the daily run, also those still in development', () => {
    const { tasks } = planFor(['daily']);
    expect(daily.filter((key) => !tasks.includes(`${key}:sandbox`))).toEqual([]);
    expect(tasks).toContain('astro-vite/default-ts:sandbox');
  });

  it('runs the Windows and Node 26 jobs only where CircleCI does', () => {
    expect(planFor(['normal']).sideJobs).toEqual([]);
    expect(planFor(['daily']).sideJobs).toEqual(['windows', 'windows-init-empty', 'node-26-smoke']);
    expect(planFor(['windows']).sideJobs).toEqual(['windows']);
  });
});

describe('the split NX targets', () => {
  const targets = (project: string) => JSON.parse(read(`${project}/project.json`)).targets;

  it('run the target they split, each with its part', () => {
    const code = targets('code');
    const without = (name: string, env: string[] = []) => {
      const copy = structuredClone(code[name]);
      env.forEach((variable) => delete copy.options.env?.[variable]);
      if (copy.options.env && Object.keys(copy.options.env).length === 0) {
        delete copy.options.env;
      }
      copy.options.command = copy.options.command.replace(/ --shard=\d+\/\d+$/, '');
      copy.outputs = copy.outputs?.map((output: string) => output.replace(`/${name}`, '/<target>'));
      return copy;
    };
    for (const [base, parts] of [
      ['test', ['test-1', 'test-2']],
      ['e2e-internal', ['e2e-internal-1', 'e2e-internal-2', 'e2e-internal-3', 'e2e-internal-4']],
      [
        'e2e-internal-static',
        [
          'e2e-internal-static-1',
          'e2e-internal-static-2',
          'e2e-internal-static-3',
          'e2e-internal-static-4',
        ],
      ],
    ] as const) {
      for (const part of parts) {
        expect(without(part, ['PLAYWRIGHT_SHARD'])).toEqual(without(base));
      }
      const shardOf = (name: string) =>
        code[name].options.env?.PLAYWRIGHT_SHARD ??
        code[name].options.command.match(/--shard=(\d+\/\d+)$/)?.[1];
      expect(parts.map(shardOf)).toEqual(parts.map((_, i) => `${i + 1}/${parts.length}`));
    }
  });

  it('split the portable stories E2E suite into parts that cover it once', () => {
    const commands: string[] = Object.entries(
      targets('test-storybooks/portable-stories-kitchen-sink/react')
    )
      .filter(([name]) => /^e2e-ui-\d+$/.test(name))
      .map(([, target]) => (target as { options: { command: string } }).options.command);
    const greps = commands.flatMap((c) => [...c.matchAll(/--grep "([^"]+)"/g)].map((m) => m[1]));
    const inverts = commands.flatMap((c) =>
      [...c.matchAll(/--grep-invert "([^"]+)"/g)].map((m) => m[1])
    );

    expect(inverts).toHaveLength(1);
    expect(greps.flatMap((g) => g.split('|')).sort()).toEqual(inverts[0].split('|').sort());

    // Apart from the selection, each part is the e2e-ui target as nx.json defines it.
    const defaults = JSON.parse(read('nx.json')).targetDefaults['e2e-ui'];
    const parts = Object.entries(targets('test-storybooks/portable-stories-kitchen-sink/react'))
      .filter(([name]) => /^e2e-ui-\d+$/.test(name))
      .map(([name, target]) => [name, structuredClone(target) as Record<string, any>] as const);
    for (const [name, part] of parts) {
      part.options.command = part.options.command.replace(/ --grep(-invert)? "[^"]+"$/, '');
      part.outputs = part.outputs.map((output: string) => output.replace(`/${name}`, '/e2e-ui'));
      expect(part).toEqual(defaults);
    }
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
