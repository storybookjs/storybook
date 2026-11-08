import { beforeEach, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  type JsPackageManager,
  PackageManagerName,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { info } from './info.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const runPackageCommand = vi.fn();

beforeEach(() => {
  vi.mocked(logger.log).mockImplementation(() => {});
  vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue({
    type: PackageManagerName.YARN1,
    runPackageCommand,
  } as unknown as JsPackageManager);
});

it('runs a pinned envinfo remotely and marks the active package manager', async () => {
  runPackageCommand.mockResolvedValue({
    stdout: '\n  Binaries:\n    Yarn: 1.22.22\n    npm: 11.16.0\n',
  });

  await info();

  expect(runPackageCommand).toHaveBeenCalledWith(
    expect.objectContaining({
      args: expect.arrayContaining(['--yes', 'envinfo@7.14.0', '--raw']),
      useRemotePkg: true,
    })
  );
  const output = String(vi.mocked(logger.log).mock.lastCall?.[0]);
  expect(output).toContain('Yarn: 1.22.22 <----- active');
  expect(output).not.toContain('npm: 11.16.0 <----- active');
});
