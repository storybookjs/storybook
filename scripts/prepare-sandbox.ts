import { existsSync } from 'node:fs';
import { cp, readFile, readdir, rm } from 'node:fs/promises';

import { join } from 'pathe';
import waitOn from 'wait-on';

import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants.ts';
import { exec } from './utils/exec.ts';
import { isNxTaskExecution } from './utils/nx.ts';

const sameFile = async (a: string, b: string) => {
  const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);
  const [left, right] = await Promise.all([read(a), read(b)]);
  return left !== undefined && left === right;
};

// Makes `sandboxDir` a copy of `cacheDir`, where NX keeps what the `sandbox` task (and a `build`,
// for `storybook-static`) produced: the tasks of an NX agent share the sandbox, so a task would
// otherwise inherit what an earlier one changed there, such as the story the onboarding E2E test
// saves. Keeps node_modules installed for the same manifest and lockfile, and says whether it did.
export async function restoreSandbox(cacheDir: string, sandboxDir: string): Promise<boolean> {
  if (!existsSync(cacheDir)) {
    throw new Error(
      `Sandbox should exist at ${cacheDir}. Did you forget to run the sandbox command first?`
    );
  }
  const keepNodeModules =
    existsSync(join(sandboxDir, 'node_modules')) &&
    (await sameFile(join(cacheDir, 'yarn.lock'), join(sandboxDir, 'yarn.lock'))) &&
    (await sameFile(join(cacheDir, 'package.json'), join(sandboxDir, 'package.json')));

  console.log(`🧹 copying cached ${cacheDir} to ${sandboxDir}`);
  // On Windows a dev server the previous task stopped can hold its files for a moment.
  const remove = (path: string) => rm(path, { recursive: true, force: true, maxRetries: 5 });
  if (keepNodeModules) {
    const entries = await readdir(sandboxDir);
    await Promise.all(
      entries
        .filter((entry) => entry !== 'node_modules')
        .map((entry) => remove(join(sandboxDir, entry)))
    );
  } else {
    await remove(sandboxDir);
  }
  await cp(cacheDir, sandboxDir, { recursive: true, force: true });
  return keepNodeModules;
}

/**
 * Prepares a sandbox for use during NX task execution.
 *
 * In NX CI, the `sandbox` task caches its output at `sandbox/<dir>` (inside the repo, without
 * node_modules). Downstream tasks need the sandbox at `../storybook-sandboxes/<dir>` with
 * node_modules installed. This function bridges that gap by:
 *
 * 1. Restoring the sandbox from the NX cache (see `restoreSandbox`)
 * 2. Waiting for the local verdaccio registry (when using --no-link)
 * 3. Running `yarn install` to restore node_modules, unless they were kept
 * 4. Running framework-specific setup (e.g. svelte-kit sync)
 *
 * This is called at the start of each downstream task's `run()` (dev, build, serve, etc.) instead
 * of being a separate NX target, so that NX Cloud doesn't have uncacheable tasks.
 *
 * No-op when not running under NX (i.e. when using `yarn task` directly).
 */
export async function prepareSandbox({ key, link }: { key: string; link: boolean }): Promise<void> {
  // When running via `yarn task`, the sandbox task already fully initializes
  // the sandbox (including node_modules), so no preparation is needed.
  if (!isNxTaskExecution()) {
    return;
  }

  const templateDir = key.replace('/', '-');

  // sandboxDir: where tasks actually run (e.g. ../storybook-sandboxes/react-vite-default-ts)
  // cacheDir: where NX caches sandbox output (e.g. sandbox/react-vite-default-ts, inside repo)
  const sandboxDir = join(SANDBOX_DIRECTORY, templateDir);
  const cacheDir = join(ROOT_DIRECTORY, 'sandbox', templateDir);

  // With STORYBOOK_SANDBOX_ROOT=./sandbox the tasks run in the cached sandbox itself.
  const installed =
    sandboxDir === cacheDir
      ? existsSync(join(sandboxDir, 'node_modules'))
      : await restoreSandbox(cacheDir, sandboxDir);

  if (!installed) {
    // In --no-link mode, packages are installed from a local verdaccio registry
    // that must be running before we can install
    if (!link) {
      await waitOn({
        log: true,
        resources: ['http://localhost:6001', 'http://localhost:6002'],
        interval: 16,
        timeout: 10000,
      });
    }

    // Restore node_modules — the NX cache deliberately excludes them to keep
    // the remote cache small. The yarn cache is shared, so this is fast.
    await exec('yarn install --immutable', { cwd: sandboxDir }, { debug: true });
  }

  // SvelteKit requires a sync step to generate types after install
  if (key.includes('svelte-kit')) {
    await exec('yarn exec svelte-kit sync', { cwd: sandboxDir }, { debug: true });
  }
}
