import { resolve } from 'node:path';

import { expect, it, vi } from 'vitest';

import { prepareSandbox } from './prepare-sandbox.ts';
import { syncLinkedPackages } from './utils/pnpm.ts';

vi.mock('./utils/nx.ts', () => ({ isNxTaskExecution: vi.fn(() => false) }));
vi.mock('./utils/pnpm.ts', () => ({
  isLinkedSandbox: vi.fn(async () => true),
  syncLinkedPackages: vi.fn(async () => {}),
}));

it('refreshes a linked sandbox with the dry run and debug settings of the task', async () => {
  const sandboxDir = resolve('sandboxes', 'react-vite-default-ts');

  await prepareSandbox({
    key: 'react-vite/default-ts',
    link: true,
    sandboxDir,
    dryRun: true,
    debug: true,
  });

  expect(syncLinkedPackages).toHaveBeenCalledWith({ cwd: sandboxDir, dryRun: true, debug: true });
});
