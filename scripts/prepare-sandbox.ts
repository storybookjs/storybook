import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';

import { join } from 'path';
import waitOn from 'wait-on';

import { ROOT_DIRECTORY } from './utils/constants.ts';
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
 * 3. Running `pnpm install` to restore node_modules
 * 4. Running framework-specific setup (e.g. svelte-kit sync)
 * 5. Copying storybook-static from cache (if a build was cached)
 *
 * This is called at the start of each downstream task's `run()` (dev, build, serve, etc.)
 * instead of being a separate NX target, so that NX Cloud doesn't have uncacheable tasks.
 *
 * When not running under NX (i.e. when using `pnpm task` directly), it only syncs the monorepo
 * packages into a linked sandbox, so the task runs the latest compile. It is a no-op under NX when
 * the sandbox is already prepared (node_modules exist).
 */
export async function prepareSandbox({
  key,
  link,
  sandboxDir,
}: {
  key: string;
  link: boolean;
  // Where tasks actually run, e.g. ../storybook-sandboxes/react-vite-default-ts.
  sandboxDir: string;
}): Promise<void> {
  // Where NX caches sandbox output (e.g. sandbox/react-vite-default-ts, inside repo)
  const cacheDir = join(ROOT_DIRECTORY, 'sandbox', key.replace('/', '-'));

  // When running via `pnpm task`, the sandbox task already fully initializes
  // the sandbox (including node_modules), so only linked packages need a refresh.
  if (!isNxTaskExecution()) {
    // Imported lazily because it imports from `code/`, which may not be installed yet.
    const { isLinkedSandbox, syncLinkedPackages } = await import('./utils/pnpm.ts');
    if (link && (await isLinkedSandbox(sandboxDir))) {
      await syncLinkedPackages({ cwd: sandboxDir, dryRun: false, debug: false });
    }
    return;
  }

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
    // the remote cache small. The pnpm store is shared, so this is fast.
    await exec('pnpm install --frozen-lockfile', { cwd: sandboxDir }, { debug: true });
  }

  // SvelteKit requires a sync step to generate types after install
  if (key.includes('svelte-kit')) {
    await exec('pnpm exec svelte-kit sync', { cwd: sandboxDir }, { debug: true });
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
