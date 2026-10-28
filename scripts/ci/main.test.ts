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

  it.each([{ args: [] }, { args: ['--workflow=unknown'] }])('rejects $args', ({ args }) => {
    const result = generate(...args);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected a comma-separated list of');
  });
});

type WorkflowJobEntry = string | Record<string, { requires: (string | Record<string, string>)[] }>;

type GeneratedConfig = {
  jobs: Record<string, { steps?: { run?: { name: string; command: string } }[] }>;
  workflows: Record<string, { jobs: WorkflowJobEntry[] }>;
};

const generateConfig = (...args: string[]): GeneratedConfig => {
  const result = generate(...args, '--base-ref=HEAD');

  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8'));
};

const workflowJobs = (config: GeneratedConfig) => Object.values(config.workflows)[0].jobs;

/** The `requires` of a workflow job entry; `undefined` when the job is not in the workflow. */
const requiresOf = (config: GeneratedConfig, id: string) => {
  const entry = workflowJobs(config).find((job) =>
    typeof job === 'string' ? job === id : id in job
  );
  if (entry === undefined) {
    return undefined;
  }
  return typeof entry === 'string' ? [] : entry[id].requires;
};

const chromaticCommand = (config: GeneratedConfig) =>
  config.jobs['local-storybook---chromatic'].steps?.find(
    (step) => step.run?.name === 'Run Chromatic'
  )?.run?.command;

describe('chromatic-completion', () => {
  it('mirrors the internal Storybook Chromatic job when the workflow runs it', () => {
    const config = generateConfig('--workflow=normal');

    expect(requiresOf(config, 'chromatic-completion')).toEqual(['local-storybook---chromatic']);
  });

  it('passes on its own when the workflow has no internal Storybook Chromatic job', () => {
    for (const workflow of ['docs', 'focus']) {
      const config = generateConfig(`--workflow=${workflow}`);

      expect(requiresOf(config, 'local-storybook---chromatic'), workflow).toBeUndefined();
      expect(requiresOf(config, 'chromatic-completion'), workflow).toEqual([]);
    }
  });

  it('is left out of a windows-only run, like circleci-completion', () => {
    const config = generateConfig('--workflow=windows');

    expect(requiresOf(config, 'chromatic-completion')).toBeUndefined();
    expect(requiresOf(config, 'circleci-completion')).toBeUndefined();
  });

  it('keeps circleci-completion independent of the Chromatic verdict', () => {
    const config = generateConfig('--workflow=normal');
    const requires = requiresOf(config, 'circleci-completion');

    expect(requires).toContain('build--linux');
    expect(requires).not.toContain('local-storybook---chromatic');
    expect(requires).not.toContain('chromatic-completion');
  });

  it.each(['normal', 'daily'])(
    'waits for the Chromatic verdict on a %s PR run, failing while changes await review',
    (workflow) => {
      const config = generateConfig(`--workflow=${workflow}`, '--branch=some-feature');

      expect(chromaticCommand(config)).toBe('yarn storybook:ui:chromatic');
    }
  );

  it('only publishes on the nightly next run, whose baseline drift is accepted by hand', () => {
    const config = generateConfig('--workflow=daily', '--branch=next');

    expect(chromaticCommand(config)).toBe(
      'yarn storybook:ui:chromatic --exit-zero-on-changes --exit-once-uploaded'
    );
    expect(requiresOf(config, 'nightly-failure-report')).toEqual([
      { 'circleci-completion': 'terminal' },
      { 'chromatic-completion': 'terminal' },
    ]);
  });

  it('runs a script that waits for the verdict instead of exiting once uploaded', () => {
    const { scripts } = JSON.parse(readFileSync(join(repoRoot, 'code/package.json'), 'utf8'));

    expect(scripts['storybook:ui:chromatic']).toBe(
      'chromatic --storybook-build-dir storybook-static'
    );
  });
});
