import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  type JsPackageManager,
  PackageManagerName,
} from 'storybook/internal/common';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { resolve } from 'pathe';

import { getSandboxPackageManager } from './sandbox.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const SANDBOX = resolve('sandbox');

const download = (packageJson: Record<string, unknown>) =>
  vol.fromJSON({ [`${SANDBOX}/package.json`]: JSON.stringify(packageJson) });

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
  vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue({
    getCommandName: () => 'npm',
  } as unknown as JsPackageManager);
});

describe('getSandboxPackageManager', () => {
  describe('for a downloaded after-storybook', () => {
    it.each([
      [
        'pnpm',
        'pnpm@10.34.9+sha512.f49b5a8ea0fdedb44bb3c0c1d6575092a53c2950d95b7ad15df11f17974877a2',
      ],
      ['yarn', 'yarn@4.18.0'],
      ['bun', 'bun@1.3.0'],
      ['npm', 'npm@11.17.0'],
    ])('names %s for a sandbox pinned to %s', async (expected, packageManager) => {
      download({ name: 'before-storybook', packageManager });

      await expect(getSandboxPackageManager(SANDBOX, { initiated: false })).resolves.toBe(expected);
    });

    it('falls back to npm when the sandbox pins nothing', async () => {
      download({ name: 'before-storybook' });

      await expect(getSandboxPackageManager(SANDBOX, { initiated: false })).resolves.toBe('npm');
    });

    it('falls back to npm when the download has no package.json', async () => {
      await expect(getSandboxPackageManager(SANDBOX, { initiated: false })).resolves.toBe('npm');
    });
  });

  describe('after init ran on a downloaded before-storybook', () => {
    it('names the package manager init installed with, not the one the sandbox pins', async () => {
      // Without pnpm on PATH, init detects npm for a pnpm sandbox.
      download({ name: 'before-storybook', packageManager: 'pnpm@10.34.9' });

      await expect(getSandboxPackageManager(SANDBOX, { initiated: true })).resolves.toBe('npm');
      expect(JsPackageManagerFactory.getPackageManager).toHaveBeenCalledWith(
        { force: undefined },
        SANDBOX
      );
    });

    it('honours a forced package manager', async () => {
      await getSandboxPackageManager(SANDBOX, { initiated: true, force: PackageManagerName.PNPM });

      expect(JsPackageManagerFactory.getPackageManager).toHaveBeenCalledWith(
        { force: PackageManagerName.PNPM },
        SANDBOX
      );
    });
  });
});
