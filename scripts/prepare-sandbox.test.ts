import { resolve } from 'pathe';
import { beforeEach, expect, it, vi } from 'vitest';

import { prepareSandbox } from './prepare-sandbox.ts';
import { isNxTaskExecution } from './utils/nx.ts';
import { isLinkedSandbox, syncLinkedPackages } from './utils/pnpm.ts';

vi.mock('./utils/nx.ts', { spy: true });
vi.mock('./utils/pnpm.ts', { spy: true });

beforeEach(() => {
  vi.mocked(isNxTaskExecution).mockReturnValue(false);
  vi.mocked(isLinkedSandbox).mockResolvedValue(true);
  vi.mocked(syncLinkedPackages).mockResolvedValue(undefined);
});

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
