import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { runMemoryBenchmark } from '../bench/memory.ts';
import type { Task } from '../task.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

const HMR_FILE = 'src/stories/Button.tsx';

export const memory: Task = {
  description: 'Measure Storybook dev, HMR, and build memory in a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ key, sandboxDir }, { link }) {
    await prepareSandbox({ key, link });
    const hmrFile = join(sandboxDir, HMR_FILE);
    await access(hmrFile);
    const result = await runMemoryBenchmark({
      cwd: sandboxDir,
      scenario: `${key}:dev-hmr-build`,
      hmrFile,
    });
    const output = join(sandboxDir, 'memory-benchmark.json');
    await writeFile(output, JSON.stringify(result, null, 2));
    console.log(`Memory benchmark written to ${output}`);
  },
};
