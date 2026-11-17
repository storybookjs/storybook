import * as fs from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memoryFs, vol } from 'memfs';

import { temporaryDirectory } from '../../code/core/src/common/utils/cli.ts';
import { sbInit } from './generate.ts';

const { launch } = vi.hoisted(() => ({
  launch: vi.fn<(command: string, options: { env: NodeJS.ProcessEnv }) => Promise<void>>(),
}));
vi.mock('execa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('execa')>()),
  execaCommand: launch,
}));
vi.mock('node:fs/promises', { spy: true });
vi.mock('../../code/core/src/common/utils/cli.ts', () => ({ temporaryDirectory: vi.fn() }));

const configHome = resolve('sandbox-config');
const personalConfig = resolve('personal-config');
const settingsFile = (root: string) => join(root, 'storybook', 'settings.json');
const personalSettings = JSON.stringify({ version: 1, init: { skipOnboarding: true } });

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(configHome, { recursive: true });
  vol.mkdirSync(join(personalConfig, 'storybook'), { recursive: true });
  vol.writeFileSync(settingsFile(personalConfig), personalSettings);
  vi.mocked(temporaryDirectory).mockResolvedValue(configHome);
  vi.mocked(fs.mkdir).mockImplementation(memoryFs.promises.mkdir as never);
  vi.mocked(fs.writeFile).mockImplementation(memoryFs.promises.writeFile as never);
  vi.mocked(fs.rm).mockImplementation(memoryFs.promises.rm as never);
});

describe('sandbox init', () => {
  it('runs with fresh settings while preserving template flags and the registry environment', async () => {
    const registry = 'http://localhost:6001/';
    launch.mockImplementationOnce(async (command, { env }) => {
      expect(command).toContain('--yes --no-dev --package-manager=yarn2');
      expect(env.npm_config_registry).toBe(registry);
      expect(env.XDG_CONFIG_HOME).toBe(configHome);
      const file = settingsFile(configHome);
      expect(JSON.parse(vol.readFileSync(file, 'utf8') as string)).toEqual({ version: 1 });
      vol.writeFileSync(file, JSON.stringify({ version: 1, init: { skipOnboarding: false } }));
    });

    await sbInit(
      resolve('project'),
      { XDG_CONFIG_HOME: personalConfig, npm_config_registry: registry },
      ['--no-dev', '--package-manager=yarn2']
    );

    expect(launch).toHaveBeenCalledOnce();
    expect(vol.readFileSync(settingsFile(personalConfig), 'utf8')).toBe(personalSettings);
    expect(vol.existsSync(configHome)).toBe(false);
  });

  it('cleans up the settings directory when init fails', async () => {
    const error = new Error('init failed');
    launch.mockRejectedValueOnce(error);

    await expect(sbInit(resolve('project'))).rejects.toBe(error);

    expect(vol.existsSync(configHome)).toBe(false);
  });

  it('cleans up and skips init when the settings file cannot be seeded', async () => {
    const error = new Error('write failed');
    vi.mocked(fs.writeFile).mockRejectedValueOnce(error);

    await expect(sbInit(resolve('project'))).rejects.toBe(error);

    expect(launch).not.toHaveBeenCalled();
    expect(vol.existsSync(configHome)).toBe(false);
  });
});
