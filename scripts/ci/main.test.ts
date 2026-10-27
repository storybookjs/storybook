import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { workflows } from './utils/types.ts';

const repoRoot = join(import.meta.dirname, '../..');

const generate = (...args: string[]) =>
  spawnSync(process.execPath, ['--experimental-transform-types', './scripts/ci/main.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

describe('main.ts under plain Node, as the CircleCI setup job runs it', () => {
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

  it('compiles packages before running unit tests on node-26-smoke', () => {
    const result = generate('--workflow=daily', '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    const config = JSON.parse(
      readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8')
    );
    const steps: { name: string; command?: string }[] = config.jobs['node-26-smoke'].steps.map(
      (step: Record<string, { name?: string; command?: string }>) => ({
        name: step.run?.name ?? Object.keys(step)[0],
        command: step.run?.command,
      })
    );
    const installIndex = steps.findIndex((step) => step.name === 'node/install-packages');
    const compileIndex = steps.findIndex((step) => step.name === 'Compile');
    const unitTestsIndex = steps.findIndex((step) => step.name === 'Run unit tests');
    expect(compileIndex).toBeGreaterThan(installIndex);
    expect(compileIndex).toBeLessThan(unitTestsIndex);
    expect(steps[compileIndex].command).toBe(
      'yarn task --task compile --start-from=auto --no-link'
    );
  });

  it.each([{ args: [] }, { args: ['--workflow=unknown'] }])('rejects $args', ({ args }) => {
    const result = generate(...args);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected a comma-separated list of');
  });
});
