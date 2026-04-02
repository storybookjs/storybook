import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';

import { join } from 'path';
import waitOn from 'wait-on';

import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants.ts';
import { exec } from './utils/exec.ts';
import { isNxTaskExecution } from './utils/nx.ts';

/**
 * Prepares a sandbox for use during NX task execution.
 *
 * In NX CI, the `sandbox` task caches its output at `sandbox/<dir>` (inside the repo,
 * without node_modules). Downstream tasks need the sandbox at `../storybook-sandboxes/<dir>`
 * with node_modules installed. This function bridges that gap by:
 *
 * 1. Copying the cached sandbox to the working directory (if needed)
 * 2. Waiting for the local verdaccio registry (when using --no-link)
 * 3. Running `yarn install` to restore node_modules
 * 4. Running framework-specific setup (e.g. svelte-kit sync)
 * 5. Copying storybook-static from cache (if a build was cached)
 *
 * This is called at the start of each downstream task's `run()` (dev, build, serve, etc.)
 * instead of being a separate NX target, so that NX Cloud doesn't have uncacheable tasks.
 *
 * No-op when not running under NX (i.e. when using `yarn task` directly),
 * or when the sandbox is already prepared (node_modules exist).
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

  // Fast path: if node_modules already exist, the sandbox was already prepared
  // by a previous task in the same pipeline (e.g. build already prepared, so serve can skip)
  if (!existsSync(join(sandboxDir, 'node_modules'))) {
    // Copy from NX cache to the actual working directory
    if (sandboxDir !== cacheDir) {
      console.log(`🧹 copying cached ${cacheDir} to ${sandboxDir}`);
      await rm(sandboxDir, { recursive: true, force: true });
      if (!existsSync(cacheDir)) {
        throw new Error(
          `Sandbox should exist at ${cacheDir}. Did you forget to run the sandbox command first?`
        );
      }
      // cache dir is created in the sandbox command that should be run before this script
      await cp(cacheDir, sandboxDir, { recursive: true, force: true });
    }

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

  // If a `build` task already ran and cached storybook-static, copy it over
  // so that serve/chromatic tasks can use it without rebuilding
  const storybookStaticSandboxDir = join(sandboxDir, 'storybook-static');
  const storybookStaticCacheDir = join(cacheDir, 'storybook-static');

  if (existsSync(storybookStaticCacheDir) && !existsSync(storybookStaticSandboxDir)) {
    console.log(`🧹 copying cached ${storybookStaticCacheDir} to ${storybookStaticSandboxDir}`);
    await cp(storybookStaticCacheDir, storybookStaticSandboxDir, {
      recursive: true,
      force: true,
    });
  }
}
