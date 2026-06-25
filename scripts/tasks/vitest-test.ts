import { createWriteStream } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';
// eslint-disable-next-line depend/ban-dependencies
import glob from 'fast-glob';
import picocolors from 'picocolors';

import type { Task } from '../task.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

/**
 * Directory (relative to the sandbox) where we gather the run's diagnostics so CI can upload them
 * as artifacts. Browser-mode runs sometimes die with an opaque "Browser connection was closed"
 * once the page crashes, and the bare task output rarely explains why — these files do.
 */
const ARTIFACTS_DIR = 'vitest-artifacts';

export const vitestTests: Task = {
  description: 'Run the Vitest tests of a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir, key }, { dryRun, link }) {
    await prepareSandbox({ key, link });
    console.log(`running Vitest tests in ${sandboxDir}`);

    // The angular-vite sandbox JIT-compiles every story in browser mode, holding many Chromium
    // contexts at once and OOM-killing the CI container (exit 137). Run its files sequentially to
    // cap peak memory. Scoped to CI here rather than the framework config so users keep the default
    // parallelism; other templates are light enough to stay parallel.
    const extraFlags = key.startsWith('angular-vite/') ? ' --no-file-parallelism' : '';

    // `retain-on-failure` keeps a Playwright trace for any story that fails without taking the
    // whole browser down, which is exactly the data missing when a run flakes.
    const command = `yarn vitest run --testTimeout=15000${extraFlags} --browser.trace=retain-on-failure`;

    if (dryRun) {
      console.log(`\n> ${command}\n`);
      return;
    }

    const logFile = join(sandboxDir, ARTIFACTS_DIR, 'vitest.log');
    await mkdir(join(sandboxDir, ARTIFACTS_DIR), { recursive: true });
    const logStream = createWriteStream(logFile);

    try {
      await execa(command, {
        cwd: sandboxDir,
        shell: true,
        stdin: 'inherit',
        // Stream to the CI console while persisting a copy for the `store_artifacts` step.
        stdout: ['inherit', logStream],
        stderr: ['inherit', logStream],
        env: {
          // Surface the browser process's own stdout/stderr (crash dumps, OOM messages) which
          // Playwright otherwise swallows. Appended so a caller-provided DEBUG still applies.
          DEBUG: process.env.DEBUG ? `${process.env.DEBUG},pw:browser` : 'pw:browser',
        },
      });
    } catch (err) {
      console.error(picocolors.red(`An error occurred while executing: \`${command}\``));
      throw err;
    } finally {
      logStream.end();
      await collectTraces(sandboxDir);
    }
  },
};

/**
 * Vitest writes Playwright traces next to each test file under `__traces__/`. Gather them into a
 * single directory so CI can upload them as one artifact. Runs on success and failure alike.
 */
async function collectTraces(sandboxDir: string) {
  const traces = await glob('**/__traces__/**/*.trace.zip', {
    cwd: sandboxDir,
    ignore: ['**/node_modules/**', `${ARTIFACTS_DIR}/**`],
  });
  if (traces.length === 0) {
    return;
  }
  const tracesDir = join(sandboxDir, ARTIFACTS_DIR, 'traces');
  await mkdir(tracesDir, { recursive: true });
  await Promise.all(
    traces.map((trace) =>
      cp(join(sandboxDir, trace), join(tracesDir, trace.replace(/[/\\]/g, '__')))
    )
  );
  console.log(`Collected ${traces.length} Playwright trace(s) into ${tracesDir}`);
}
