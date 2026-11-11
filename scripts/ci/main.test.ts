import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { dirname, join, relative } from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { workflows } from './utils/types.ts';

const repoRoot = join(import.meta.dirname, '../..');

const generateIn = (cwd: string, ...args: string[]) =>
  spawnSync(
    process.execPath,
    ['--experimental-transform-types', join(repoRoot, 'scripts/ci/main.ts'), ...args],
    { cwd, encoding: 'utf8' }
  );

const generate = (...args: string[]) => generateIn(repoRoot, ...args);

const fixtureRoots: string[] = [];

afterEach(() => {
  fixtureRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function checkoutPullRequest({
  changesLockfile,
  baseChangesLockfile = false,
  pushedAfterMerge = false,
}: {
  changesLockfile: boolean;
  baseChangesLockfile?: boolean;
  pushedAfterMerge?: boolean;
}) {
  const root = mkdtempSync(join(tmpdir(), 'sb-ci-pull-request-'));
  fixtureRoots.push(root);
  const [origin, dev, checkout, globalConfig] = ['origin.git', 'dev', 'checkout', 'gitconfig'].map(
    (name) => join(root, name)
  );
  // An empty global config keeps the developer's git settings, such as commit signing, out.
  writeFileSync(globalConfig, '');
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: globalConfig,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    });
  const commit = (file: string, content: string) => {
    writeFileSync(join(dev, file), content);
    git(dev, 'add', file);
    git(dev, 'commit', '-m', `${file}: ${content}`);
  };

  git(root, 'init', '--bare', '--initial-branch=next', origin);
  git(root, 'init', '--initial-branch=next', dev);
  commit('pnpm-lock.yaml', 'base');
  commit('README.md', 'base');
  git(dev, 'checkout', '-b', 'pull');
  commit(changesLockfile ? 'pnpm-lock.yaml' : 'README.md', 'pull request');
  if (baseChangesLockfile) {
    git(dev, 'checkout', 'next');
    commit('pnpm-lock.yaml', 'next moved on');
  }
  git(dev, 'checkout', '--detach', 'next');
  git(dev, 'merge', '--no-ff', '-m', 'Merge pull request 1', 'pull');
  git(dev, 'push', origin, 'HEAD:refs/pull/1/merge');
  if (pushedAfterMerge) {
    git(dev, 'checkout', 'pull');
    commit('README.md', 'pushed after GitHub merged');
  }
  git(dev, 'push', origin, 'pull', 'next');
  git(root, 'clone', '--depth=2', '--branch=pull', pathToFileURL(origin).href, checkout);
  return checkout;
}

const dedupeCheckGenerated = () =>
  readConfig()
    .jobs['build--linux'].steps.map((step: { run?: { name: string } }) => step.run?.name)
    .includes('Check for dedupe');

const readConfig = () =>
  JSON.parse(readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8'));

const valueImportPattern = /^(?:import|export)(?!\s+type\b)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/gm;

const importSpecifiers = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(valueImportPattern)].map((match) => match[1]);

describe('main.ts under plain Node, as the CircleCI setup job runs it', () => {
  it('imports only Node built-ins, because the setup job runs before pnpm install', () => {
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
    const config = readConfig();
    expect(Object.keys(config.workflows)).toEqual([`${workflow}-generated`]);
  });

  it.each(workflows)('never runs Yarn in the %s workflow', (workflow) => {
    const result = generate(
      `--workflow=${workflow}`,
      '--base-ref=HEAD',
      '--gh-trusted-author=true'
    );

    expect(result.status, result.stderr).toBe(0);
    const { jobs } = readConfig();
    const yarnSteps = Object.entries<{ steps?: { run?: { name?: string } }[] }>(jobs).flatMap(
      ([id, { steps = [] }]) =>
        steps
          .filter((step) => /yarn/i.test(JSON.stringify(step)))
          .map((step) => `${id}: ${step.run?.name ?? JSON.stringify(step)}`)
    );
    expect(yarnSteps).toEqual([]);
  });

  it('packs the node_modules of every workspace package', () => {
    const result = generate('--workflow=normal', '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    const steps: { run?: { name: string; command: string } }[] =
      readConfig().jobs['build--linux'].steps;
    const pack = steps.find((step) => step.run?.name.startsWith('Pack node_modules'));
    const packed = new Set(pack?.run?.command.split(/[\s;]+/));
    const importers = Object.keys(
      parse(readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8')).importers
    ).map((importer) => (importer === '.' ? 'node_modules' : `${importer}/node_modules`));

    expect(importers).toContain('code/core/node_modules');
    expect(importers.filter((dir) => !packed.has(`project/${dir}`))).toEqual([]);
  });

  it('skips the dedupe check for a run that is not a pull request', () => {
    const result = generate('--workflow=normal', '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    expect(dedupeCheckGenerated()).toBe(false);
  });

  it.each([
    {
      name: 'runs the dedupe check for a pull request that changes pnpm-lock.yaml',
      pullRequest: { changesLockfile: true },
      expected: true,
    },
    {
      name: 'skips the dedupe check for a pull request that leaves pnpm-lock.yaml alone while its base changes it',
      pullRequest: { changesLockfile: false, baseChangesLockfile: true },
      expected: false,
    },
  ])('$name', ({ pullRequest, expected }) => {
    const result = generateIn(
      checkoutPullRequest(pullRequest),
      '--workflow=normal',
      '--base-ref=HEAD',
      '--gh-pr-number=1'
    );

    expect(result.status, result.stderr).toBe(0);
    expect(dedupeCheckGenerated()).toBe(expected);
  });

  it.each([
    {
      name: 'runs the dedupe check for a pull request that changes pnpm-lock.yaml and was pushed to after GitHub last merged it',
      pullRequest: { changesLockfile: true, pushedAfterMerge: true },
      prNumber: '1',
      warning: 'refs/pull/1/merge does not merge HEAD',
      expected: true,
    },
    {
      name: 'skips the dedupe check for a pull request that leaves pnpm-lock.yaml alone and was pushed to after GitHub last merged it',
      pullRequest: { changesLockfile: false, pushedAfterMerge: true },
      prNumber: '1',
      warning: 'refs/pull/1/merge does not merge HEAD',
      expected: false,
    },
    {
      name: 'runs the dedupe check for a pull request without a merge ref',
      pullRequest: { changesLockfile: false },
      prNumber: '2',
      warning: 'Cannot tell whether pull request 2 changes pnpm-lock.yaml',
      expected: true,
    },
  ])('$name, with a warning', ({ pullRequest, prNumber, warning, expected }) => {
    const result = generateIn(
      checkoutPullRequest(pullRequest),
      '--workflow=normal',
      '--base-ref=HEAD',
      `--gh-pr-number=${prNumber}`
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain(warning);
    expect(dedupeCheckGenerated()).toBe(expected);
  });

  it("leaves the checkout's history alone", () => {
    const checkout = checkoutPullRequest({ changesLockfile: true });
    const history = () =>
      execFileSync('git', ['rev-list', 'HEAD'], { cwd: checkout, encoding: 'utf8' });
    const before = history();

    const result = generateIn(checkout, '--workflow=normal', '--base-ref=HEAD', '--gh-pr-number=1');

    expect(result.status, result.stderr).toBe(0);
    expect(before.trim().split('\n')).toHaveLength(2);
    expect(history()).toBe(before);
  });

  it('rejects a pull request number that is not a number', () => {
    const result = generate('--workflow=normal', '--base-ref=HEAD', '--gh-pr-number=1:main');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Invalid pull request number "1:main"');
  });

  it.each([{ args: [] }, { args: ['--workflow=unknown'] }])('rejects $args', ({ args }) => {
    const result = generate(...args);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected a comma-separated list of');
  });
});
