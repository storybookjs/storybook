import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from 'storybook/internal/common';

import {
  forgetUpgradeStart,
  rememberUpgradeStart,
  upgradeStartVersion,
} from './pending-upgrade.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const store = new Map<string, unknown>();

beforeEach(() => {
  store.clear();
  vi.mocked(cache.get).mockImplementation(async (key: string) => store.get(key));
  vi.mocked(cache.set).mockImplementation(async (key: string, value: unknown) => {
    store.set(key, value);
  });
  vi.mocked(cache.remove).mockImplementation(async (key: string) => {
    store.delete(key);
  });
});

const start = (installed: string, target = '11.0.0') =>
  upgradeStartVersion({ configDir: '/repo/.storybook', installed, target });

describe('upgradeStartVersion', () => {
  it('is the installed version without an unfinished upgrade', async () => {
    await expect(start('10.6.7')).resolves.toBe('10.6.7');
  });

  it('is the start of an unfinished upgrade to the same version, after an install', async () => {
    await rememberUpgradeStart('/repo/.storybook', { from: '10.6.7', to: '11.0.0' });

    await expect(start('11.0.0')).resolves.toBe('10.6.7');
  });

  it('ignores an unfinished upgrade to another version', async () => {
    await rememberUpgradeStart('/repo/.storybook', { from: '10.6.7', to: '11.0.0-beta.2' });

    await expect(start('11.0.0', '11.0.0')).resolves.toBe('11.0.0');
  });

  it('ignores an unfinished upgrade of another project', async () => {
    await rememberUpgradeStart('/repo/other/.storybook', { from: '10.6.7', to: '11.0.0' });

    await expect(start('11.0.0')).resolves.toBe('11.0.0');
  });

  it('is the installed version once the upgrade ran its automigrations', async () => {
    await rememberUpgradeStart('/repo/.storybook', { from: '10.6.7', to: '11.0.0' });
    await forgetUpgradeStart('/repo/.storybook');

    await expect(start('11.0.0')).resolves.toBe('11.0.0');
  });

  it('is the installed version when the cache cannot be read', async () => {
    vi.mocked(cache.get).mockRejectedValue(new Error('EACCES'));

    await expect(start('11.0.0')).resolves.toBe('11.0.0');
  });
});
