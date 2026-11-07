import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { build } from 'esbuild';
import { minimatch } from 'minimatch';
import { join } from 'pathe';
import { expect, it } from 'vitest';

import { needsAllUnitTests } from './global-inputs.ts';
import { agentEnvironment, agentSetup } from './nx/agent-environment.ts';
import { getNxDteJobs } from './nx/circleci-dte.ts';
import { ROOT, covers, globsOf, nxJson } from './nx/inputs.ts';

// The scripts that Nx tasks run (see the `command`s in the generated project.json files).
const TASK_ENTRY_POINTS = [
  'task.ts',
  'build/build-package.ts',
  'check/check-package.ts',
  'run-registry.ts',
];

it('sharedGlobals covers every script that Nx tasks import, so a change to one runs the tasks again', async () => {
  const sharedGlobals: string[] = nxJson.namedInputs.sharedGlobals.filter(
    (input: unknown) => typeof input === 'string'
  );

  const dirsPattern = sharedGlobals.find((input) => input.startsWith('{workspaceRoot}/scripts/{'));
  expect(sharedGlobals).toContain('{workspaceRoot}/scripts/*');
  expect(dirsPattern).toBeDefined();
  const coveredDirs = dirsPattern!.match(/scripts\/\{([^}]+)\}/)![1].split(',');

  const { metafile } = await build({
    absWorkingDir: join(ROOT, 'scripts'),
    entryPoints: TASK_ENTRY_POINTS,
    bundle: true,
    write: false,
    metafile: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outdir: 'out',
    logLevel: 'silent',
  });

  const uncovered = Object.keys(metafile.inputs)
    .filter((file) => !file.startsWith('..') && !file.includes('node_modules'))
    .filter((file) => file.includes('/') && !coveredDirs.includes(file.split('/')[0]));

  expect(uncovered).toEqual([]);
}, 30_000);

// `OS` is `Windows_NT` on Windows and unset elsewhere.
it('sharedGlobals keeps the Windows cache apart from the Linux and macOS cache', () => {
  expect(nxJson.namedInputs.sharedGlobals).toContainEqual({ env: 'OS' });
});

// The steps an NX agent may run before agentSetup(): its checkout and the Linux node_modules restore.
const BEFORE_SETUP = [
  'git-shallow-clone/checkout_advanced',
  'Hash the package manifests and patches',
  'restore_cache',
  'Restore node_modules',
];

const git = (args: string) =>
  execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);

// Every target of every project, with the globs its inputs hash (a dependency's `^` input as if
// it were the project's own, which is enough for the workspace files the tests below look for).
const targets = git('ls-files "*project.json"').flatMap((file) => {
  const project = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  const root = file.replace(/\/?project\.json$/, '');
  return Object.entries<Record<string, any>>(project.targets ?? {}).map(([name, own]) => {
    const target = { ...nxJson.targetDefaults[name], ...own };
    const inputs: unknown[] = target.inputs ?? ['default'];
    return {
      id: `${root || '.'}:${name}`,
      command: (target.command ?? target.options?.command ?? '') as string,
      globs: globsOf(
        inputs.map((input) => (typeof input === 'string' ? input.replace(/^\^/, '') : input)),
        project.namedInputs ?? {},
        root
      ),
    };
  });
});

it('every target hashes the scripts its command runs, so a change to one runs the target again', () => {
  const unhashed = targets.flatMap(({ id, command, globs }) =>
    (command.match(/scripts\/[\w./-]+\.(?:ts|sh|mjs|cjs|js)/g) ?? [])
      .map((script) => (script.startsWith('../') ? script.slice(3) : script))
      .filter((path) => !covers(globs, path))
      .map((path) => `${id} runs ${path}`)
  );
  expect(unhashed).toEqual([]);
}, 30_000);

const ciEnvironment: string[] = nxJson.namedInputs['ci-environment'].map((input: string) =>
  input.replace('{workspaceRoot}/', '')
);

it('every target hashes the files that set up the machine it runs on', () => {
  expect(ciEnvironment.filter((file) => !existsSync(join(ROOT, file)))).toEqual([]);
  const unhashed = targets.flatMap(({ id, globs }) =>
    ciEnvironment.filter((file) => !covers(globs, file)).map((file) => `${id} misses ${file}`)
  );
  expect(unhashed).toEqual([]);
}, 30_000);

it("the NX DTE agents take every environment variable and setup step their tasks see from the CI environment's files", () => {
  expect(ciEnvironment).toEqual(
    expect.arrayContaining([
      'scripts/ci/nx/agent-environment.ts',
      'scripts/ci/utils/executors.ts',
      'scripts/ci/utils/orbs.ts',
    ])
  );
  const jobs = getNxDteJobs(['daily'], 'unused');
  for (const [os, id] of [
    ['linux', 'nx-agent'],
    ['windows', 'nx-agent-windows'],
  ] as const) {
    const agent = jobs.find((job) => job.id === id)!.implementation('daily') as {
      environment: Record<string, string>;
      steps: { run?: { name: string } }[];
    };
    const ownEnvironment = Object.fromEntries(
      Object.entries(agent.environment).filter(
        ([name]) => !name.startsWith('NX_') && !name.startsWith('CI_CHANGED_FILES_')
      )
    );
    expect(ownEnvironment).toEqual(agentEnvironment(os));

    const setup = agentSetup(os);
    const start = agent.steps.findIndex(
      (step) => step.run?.name === 'Run the tasks NX Cloud assigns'
    );
    expect(agent.steps.slice(start - setup.length, start)).toEqual(setup);
    const before = agent.steps
      .slice(0, start - setup.length)
      .map((step) => step.run?.name ?? Object.keys(step)[0]);
    expect(before.filter((step) => !BEFORE_SETUP.includes(step))).toEqual([]);
  }
});

it('a change to a file the scripts tests read runs the unit-test targets, and every unit test in a focused run', () => {
  const tracked = git('ls-files');
  const read = git('ls-files "scripts/*.test.ts"').flatMap((test) =>
    [
      ...readFileSync(join(ROOT, test), 'utf8').matchAll(
        /\b(?:read|readFileSync)\(\s*(?:join\([^,()]+,\s*)?[`'"]([^`'"]+)[`'"]/g
      ),
    ].flatMap(([, path]) => {
      const glob = path.replace(/\$\{[^}]+\}/g, '*');
      return tracked.filter((file) => minimatch(file, glob, { dot: true }));
    })
  );
  const files = [...new Set(read)];
  const unhashed = targets
    .filter(({ id }) => /^code:test(-\d+)?$/.test(id))
    .flatMap(({ id, globs }) =>
      files.filter((file) => !covers(globs, file)).map((file) => `${id} misses ${file}`)
    );
  expect(unhashed).toEqual([]);
  expect(files.filter((file) => !needsAllUnitTests(file))).toEqual([]);
}, 30_000);
