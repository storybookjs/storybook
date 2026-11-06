import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'esbuild';
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
