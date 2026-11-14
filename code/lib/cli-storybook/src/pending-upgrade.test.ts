import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFileSystemCache } from 'storybook/internal/common';

import {
  forgetUpgradeStart,
  rememberUpgradeStart,
  upgradeStartVersion,
} from './pending-upgrade.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const store = new Map<string, unknown>();
const fakeCache = {
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  remove: vi.fn(async (key: string) => {
    store.delete(key);
  }),
};

beforeEach(() => {
  store.clear();
  vi.mocked(createFileSystemCache).mockReturnValue(
    fakeCache as unknown as ReturnType<typeof createFileSystemCache>
  );
});

const CONFIG_DIR = '/repo/.storybook';

describe('upgradeStartVersion', () => {
  it('is the installed version without an unfinished upgrade', async () => {
    await expect(upgradeStartVersion(CONFIG_DIR, '10.6.7')).resolves.toBe('10.6.7');
  });

  it('is the start of an unfinished upgrade whose version is now installed', async () => {
    await rememberUpgradeStart(CONFIG_DIR, { from: '10.6.7', to: '11.0.0' });

    await expect(upgradeStartVersion(CONFIG_DIR, '11.0.0')).resolves.toBe('10.6.7');
  });

  it('is the installed version while the unfinished upgrade is not installed yet', async () => {
    await rememberUpgradeStart(CONFIG_DIR, { from: '10.6.7', to: '11.0.0' });

    await expect(upgradeStartVersion(CONFIG_DIR, '10.6.7')).resolves.toBe('10.6.7');
  });

  it('ignores an unfinished upgrade to a version other than the installed one', async () => {
    await rememberUpgradeStart(CONFIG_DIR, { from: '9.1.0', to: '11.0.0' });

    await expect(upgradeStartVersion(CONFIG_DIR, '10.3.0')).resolves.toBe('10.3.0');
  });

  it('finds the record from another spelling of the same config dir', async () => {
    await rememberUpgradeStart('/repo/app/../.storybook', { from: '10.6.7', to: '11.0.0' });

    await expect(upgradeStartVersion(CONFIG_DIR, '11.0.0')).resolves.toBe('10.6.7');
  });

  it('ignores an unfinished upgrade of another project', async () => {
    await rememberUpgradeStart('/repo/other/.storybook', { from: '10.6.7', to: '11.0.0' });

    await expect(upgradeStartVersion(CONFIG_DIR, '11.0.0')).resolves.toBe('11.0.0');
  });

  it('is the installed version once the upgrade ran its automigrations', async () => {
    await rememberUpgradeStart(CONFIG_DIR, { from: '10.6.7', to: '11.0.0' });
    await forgetUpgradeStart(CONFIG_DIR);

    await expect(upgradeStartVersion(CONFIG_DIR, '11.0.0')).resolves.toBe('11.0.0');
  });

  it('is the installed version when the record cannot be read', async () => {
    fakeCache.get.mockRejectedValueOnce(new Error('EACCES'));

    await expect(upgradeStartVersion(CONFIG_DIR, '11.0.0')).resolves.toBe('11.0.0');
  });
});
