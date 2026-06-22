import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

export const vitestTests: Task = {
  description: 'Run the Vitest tests of a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir, key }, { dryRun, debug, link }) {
    await prepareSandbox({ key, link });
    console.log(`running Vitest tests in ${sandboxDir}`);

    // The angular-vite sandbox JIT-compiles every story in browser mode, holding many Chromium
    // contexts at once and OOM-killing the CI container (exit 137). Run its files sequentially to
    // cap peak memory. Scoped to CI here rather than the framework config so users keep the default
    // parallelism; other templates are light enough to stay parallel.
    const extraFlags = key === 'angular-cli/vite-default-ts' ? ' --no-file-parallelism' : '';

    return exec(
      `yarn vitest run --testTimeout=15000${extraFlags}`,
      { cwd: sandboxDir },
      { dryRun, debug }
    );
  },
};
