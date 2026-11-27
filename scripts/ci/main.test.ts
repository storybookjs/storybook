import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';

import { dirname, join, relative } from 'pathe';
import { describe, expect, it } from 'vitest';

import { workflows } from './utils/types.ts';

const repoRoot = join(import.meta.dirname, '../..');

const generate = (...args: string[]) =>
  spawnSync(process.execPath, ['--experimental-transform-types', './scripts/ci/main.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

const valueImportPattern = /^(?:import|export)(?!\s+type\b)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/gm;

const importSpecifiers = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(valueImportPattern)].map((match) => match[1]);

describe('main.ts under plain Node, as the CircleCI setup job runs it', () => {
  it('imports only Node built-ins, because the setup job runs before yarn install', () => {
    const queue = [join(repoRoot, 'scripts/ci/main.ts')];
    const visited = new Set<string>();
    const external: string[] = [];

    while (queue.length > 0) {
      const file = queue.pop()!;
      if (visited.has(file)) {
        continue;
      }
      visited.add(file);
      for (const specifier of importSpecifiers(file)) {
        if (specifier.startsWith('.')) {
          queue.push(join(dirname(file), specifier));
        } else if (!isBuiltin(specifier)) {
          external.push(`${relative(repoRoot, file)} imports ${specifier}`);
        }
      }
    }

    expect(visited.size).toBeGreaterThan(5);
    expect(external).toEqual([]);
  });

  it.each(workflows)('generates the %s workflow', (workflow) => {
    // `HEAD` resolves on the `--depth 1` checkout `Tests (linux)` uses; `HEAD^` does not.
    const result = generate(`--workflow=${workflow}`, '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    const config = JSON.parse(
      readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8')
    );
    expect(Object.keys(config.workflows)).toEqual([`${workflow}-generated`]);
  });

  it('caches the node_modules of every package', () => {
    const result = generate('--workflow=normal', '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    const config = readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8');
    expect(config).toContain('project/code/core/node_modules');
  });

  const generateConfig = (workflow: string) => {
    const result = generate(`--workflow=${workflow}`, '--base-ref=HEAD', '--branch=feature');
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8'));
  };

  const requiresOf = (config: any, job: string) =>
    Object.values(config.workflows as Record<string, { jobs: unknown[] }>)[0]
      .jobs.flatMap((entry) => (typeof entry === 'object' && entry ? Object.entries(entry) : []))
      .find(([id]) => id === job)?.[1].requires;

  const stepNames = (config: any, job: string) =>
    config.jobs[job].steps.map((step: any) => step.run?.name).filter(Boolean);

  it('starts the Windows unit job whatever the outcome of tests--linux, but only after build--windows', () => {
    expect(requiresOf(generateConfig('windows'), 'tests-unit--windows')).toEqual([
      'build--windows',
      { 'tests--linux': 'terminal' },
    ]);
  });

  it.each([
    { workflow: 'windows', cancels: false },
    { workflow: 'normal,windows', cancels: false },
    { workflow: 'daily', cancels: false },
    { workflow: 'normal', cancels: true },
  ])(
    'cancels the run on a tests--linux failure in $workflow: $cancels',
    ({ workflow, cancels }) => {
      expect(
        stepNames(generateConfig(workflow), 'tests--linux').includes('Cancel current workflow')
      ).toBe(cancels);
    }
  );

  it.each([
    { workflow: 'windows', full: undefined },
    { workflow: 'windows-full', full: 'true' },
  ])('runs every unit test file on Windows in $workflow: $full', ({ workflow, full }) => {
    const step = generateConfig(workflow).jobs['tests-unit--windows'].steps.find(
      (candidate: any) => candidate.run?.name === 'Run OS-sensitive unit tests'
    );
    expect(step.run.environment.STORYBOOK_WINDOWS_UNIT_FULL).toBe(full);
  });

  it.each([{ args: [] }, { args: ['--workflow=unknown'] }])('rejects $args', ({ args }) => {
    const result = generate(...args);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected a comma-separated list of');
  });
});
