import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = join(import.meta.dirname, '../..');
const ACTION = '.github/actions/setup-node-and-install';
const PACKAGE_MANAGERS = `${ACTION}/package-managers`;

const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8');
const readJson = (file: string) => JSON.parse(read(file));

type Step = { name?: string; uses?: string; if?: string };

describe(ACTION, () => {
  it('restores and saves a cache only for Yarn checkouts', () => {
    const steps: Step[] = parse(read(`${ACTION}/action.yml`)).runs.steps;
    const cacheSteps = steps.filter(({ uses }) => uses?.startsWith('actions/cache'));

    expect(cacheSteps.length).toBeGreaterThan(0);
    for (const step of cacheSteps) {
      expect(step.if, step.name).toMatch(/steps\.package-manager\.outputs\.name == 'yarn'/);
    }
  });
});

describe(PACKAGE_MANAGERS, () => {
  const { dependencies } = readJson(`${PACKAGE_MANAGERS}/package.json`);
  const { packages } = readJson(`${PACKAGE_MANAGERS}/package-lock.json`);
  const locked = (name: string): { version: string; integrity: string } =>
    packages[`node_modules/${name}`];

  it('locks the pnpm release and integrity that the packageManager field pins', () => {
    const { version, integrity } = locked('pnpm');
    const hash = Buffer.from(integrity.replace(/^sha512-/, ''), 'base64').toString('hex');

    expect(readJson('package.json').packageManager).toBe(`pnpm@${version}+sha512.${hash}`);
  });

  it('pins the same pnpm in every test storybook as in the repository', () => {
    const { packageManager } = readJson('package.json');
    const pins = execFileSync('git', ['ls-files', 'test-storybooks/**/package.json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((file) => [file, readJson(file).packageManager])
      .filter(([, pin]) => pin?.startsWith('pnpm@'));

    expect(pins.length).toBeGreaterThan(0);
    expect(pins.filter(([, pin]) => pin !== packageManager)).toEqual([]);
  });

  it('locks the Yarn release that server-kitchen-sink pins', () => {
    expect(`yarn@${locked('@yarnpkg/cli-dist').version}`).toBe(
      readJson('test-storybooks/server-kitchen-sink/package.json').packageManager
    );
  });

  it('locks the exact versions its package.json names', () => {
    const lockedVersions = Object.fromEntries(
      Object.keys(dependencies).map((name) => [name, locked(name)?.version])
    );

    expect(packages[''].dependencies).toEqual(dependencies);
    expect(lockedVersions).toEqual(dependencies);
  });
});
