import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { build } from 'esbuild';
import { minimatch } from 'minimatch';
import { join } from 'pathe';
import { expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');

// The scripts that Nx tasks run (see the `command`s in the generated project.json files).
const TASK_ENTRY_POINTS = [
  'task.ts',
  'build/build-package.ts',
  'check/check-package.ts',
  'run-registry.ts',
];

// `sharedGlobals` in nx.json lists the parts of `scripts/` that every task hashes. A script that a
// task imports from outside that list would not invalidate the cache when it changes, so tasks
// would restore stale results. This keeps the list in step with what the tasks actually import.
it('sharedGlobals covers every script that Nx tasks import', async () => {
  const nxJson = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8'));
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
});

// The NX DTE pipeline runs the same targets on Linux and on Windows (scripts/ci/nx/circleci-dte.ts).
// `OS` is `Windows_NT` on Windows and unset elsewhere, so every task that hashes sharedGlobals,
// directly or through a dependency's inputs, keeps its Windows results apart, while macOS and Linux
// still share theirs.
it('sharedGlobals keeps the Windows cache apart', () => {
  const nxJson = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8'));
  expect(nxJson.namedInputs.sharedGlobals).toContainEqual({ env: 'OS' });
});

const git = (args: string) =>
  execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);

// Every target of every project, with the globs its inputs hash (a dependency's `^` input as if
// it were the project's own, which is enough for the workspace files the tests below look for).
const targets = (() => {
  const nxJson = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8'));
  return git('ls-files "*project.json"').flatMap((file) => {
    const project = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
    const root = file.replace(/\/?project\.json$/, '');
    const named: Record<string, unknown[]> = { ...nxJson.namedInputs, ...project.namedInputs };
    const globsOf = (inputs: unknown[]): string[] =>
      inputs.flatMap((input) => {
        if (typeof input !== 'string') {
          return [];
        }
        const name = input.replace(/^\^/, '');
        if (named[name]) {
          return globsOf(named[name]);
        }
        return [input.replace('{workspaceRoot}/', '').replace('{projectRoot}', root)];
      });
    return Object.entries<Record<string, any>>(project.targets ?? {}).map(([name, own]) => {
      const target = { ...nxJson.targetDefaults[name], ...own };
      return {
        id: `${root || '.'}:${name}`,
        command: (target.command ?? target.options?.command ?? '') as string,
        globs: globsOf(target.inputs ?? ['default']),
      };
    });
  });
})();

const hashes = (globs: string[], path: string) => {
  const matches = (glob: string) => minimatch(path, glob, { dot: true });
  return (
    globs.some((glob) => !glob.startsWith('!') && matches(glob)) &&
    !globs.some((glob) => glob.startsWith('!') && matches(glob.slice(1)))
  );
};

// A target whose command runs a script from `scripts/` must hash it, through `sharedGlobals`, a
// named input, or its own inputs: otherwise a change to the script restores the old result, and
// `nx affected` does not run the task.
it('every target hashes the scripts its command runs', () => {
  const unhashed = targets.flatMap(({ id, command, globs }) =>
    (command.match(/scripts\/[\w./-]+\.(?:ts|sh|mjs|cjs|js)/g) ?? [])
      .map((script) => (script.startsWith('../') ? script.slice(3) : script))
      .filter((path) => !hashes(globs, path))
      .map((path) => `${id} runs ${path}`)
  );
  expect(unhashed).toEqual([]);
});

// The files that set up the machine a task runs on: its environment variables, its node_modules,
// the GitHub workflow and the NX Cloud workers. A change to one can break any task, so every task
// runs again instead of restoring a result from the old environment.
it('every target hashes the CI environment', () => {
  const nxJson = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8'));
  const environment: string[] = nxJson.namedInputs['ci-environment'].map((input: string) =>
    input.replace('{workspaceRoot}/', '')
  );
  expect(environment.filter((file) => !existsSync(join(ROOT, file)))).toEqual([]);
  const unhashed = targets.flatMap(({ id, globs }) =>
    environment.filter((file) => !hashes(globs, file)).map((file) => `${id} misses ${file}`)
  );
  expect(unhashed).toEqual([]);
});

// The tests of `scripts/` read repository files such as `.nx/workflows/*.yaml` to check the CI
// config against them; outside the inputs of the targets that run the tests, a change to such a
// file restores the old test result. (The tests in `code/` read fixtures in `code/` or memfs.)
it('the unit-test targets hash the files the tests read', () => {
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
  const unhashed = targets
    .filter(({ id }) => /^code:test(-\d+)?$/.test(id))
    .flatMap(({ id, globs }) =>
      [...new Set(read)]
        .filter((file) => !hashes(globs, file))
        .map((file) => `${id} misses ${file}`)
    );
  expect(unhashed).toEqual([]);
});
