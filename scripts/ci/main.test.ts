import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { getPackageDirs } from './common-jobs.ts';
import { generateConfig } from './main.ts';
import { parameters } from './utils/parameters.ts';

const repoRoot = join(import.meta.dirname, '../..');

describe('generateConfig', () => {
  it.each(parameters.workflow.enum)('preserves the complete %s workflow', (workflow) => {
    const config =
      workflow === 'focus'
        ? generateConfig({
            workflow,
            trustedAuthor: false,
            changedFiles: ['code/frameworks/angular-vite/src/preset.ts'],
          })
        : generateConfig({ workflow, trustedAuthor: false });

    expect(config).toMatchSnapshot();
  });

  it('does not leak trusted-author state between calls', () => {
    const trusted = generateConfig({ workflow: 'normal', trustedAuthor: true });
    const untrusted = generateConfig({ workflow: 'normal', trustedAuthor: false });

    expect(JSON.stringify(trusted)).toContain('save_cache');
    expect(JSON.stringify(untrusted)).not.toContain('save_cache');
  });

  it('discovers the same package directories in the same order', () => {
    expect(getPackageDirs(join(repoRoot, 'code'))).toMatchSnapshot();
  });
});

describe('CLI', () => {
  // `Tests (linux)` checks out with `--depth 1`, where `HEAD^` does not resolve and the
  // focus workflow's `git diff` aborts. `HEAD` diffs against itself on any checkout depth.
  it.each(parameters.workflow.enum)('runs the production command for %s', (workflow) => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-transform-types',
        './scripts/ci/main.ts',
        `--workflow=${workflow}`,
        '--base-ref=HEAD',
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(() =>
      JSON.parse(readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8'))
    ).not.toThrow();
  });

  it.each([{ args: [] }, { args: ['--workflow=unknown'] }])(
    'rejects invalid arguments: $args',
    ({ args }) => {
      const result = spawnSync(
        process.execPath,
        ['--experimental-transform-types', './scripts/ci/main.ts', ...args],
        { cwd: repoRoot, encoding: 'utf8' }
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('--workflow must be one of');
    }
  );
});

describe('setup config', () => {
  const setup = parse(readFileSync(join(repoRoot, '.circleci/config.yml'), 'utf8'));
  const job = setup.jobs['generate-and-run-config'];
  const serializedJob = JSON.stringify(job);

  it('runs on the pinned Node image without installing dependencies', () => {
    expect(job.docker).toEqual([{ image: 'cimg/node:22.22.3' }]);
    expect(serializedJob).not.toContain('node/install');
    expect(serializedJob).not.toContain('yarn');
    expect(serializedJob).not.toContain('Install dependencies');
  });

  it('fetches bounded blobless histories without tags', () => {
    expect(serializedJob).toContain('--depth 500 --filter=blob:none --no-tags');
    expect(serializedJob).toContain('git fetch --depth=500 --filter=blob:none --no-tags');
    expect(serializedJob).toContain('git merge-base');

    const fetchCommand = job.steps.find(
      (step: { run?: { name?: string } }) => step.run?.name === 'Fetch base branch for focused CI'
    )?.run?.command;

    expect(fetchCommand).toBeTypeOf('string');
    if (typeof fetchCommand !== 'string') {
      throw new Error('The focused CI fetch command is missing');
    }

    const syntaxCheck = spawnSync('bash', ['-n'], {
      input: fetchCommand,
      encoding: 'utf8',
    });

    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
  });
});
