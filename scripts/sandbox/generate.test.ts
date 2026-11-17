import * as fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { fs as memoryFs, vol } from 'memfs';
import { join, resolve } from 'pathe';

import { temporaryDirectory } from '../../code/core/src/common/utils/cli.ts';
import { sbInit } from './generate.ts';

vi.mock('execa', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('../../code/core/src/common/utils/cli.ts', { spy: true });

const configHome = resolve('sandbox-config');
const personalConfig = resolve('personal-config');
const settingsFile = (root: string) => join(root, 'storybook', 'settings.json');
const personalSettings = JSON.stringify({ version: 1, init: { skipOnboarding: true } });
let settingsAtInit: unknown;

beforeEach(() => {
  settingsAtInit = undefined;
  vol.reset();
  vol.mkdirSync(configHome, { recursive: true });
  vol.mkdirSync(join(personalConfig, 'storybook'), { recursive: true });
  vol.writeFileSync(settingsFile(personalConfig), personalSettings);
  vi.mocked(temporaryDirectory).mockResolvedValue(configHome);
  vi.mocked(fs.mkdir).mockImplementation(memoryFs.promises.mkdir as never);
  vi.mocked(fs.writeFile).mockImplementation(memoryFs.promises.writeFile as never);
  vi.mocked(fs.rm).mockImplementation(memoryFs.promises.rm as never);
  vi.mocked(execaCommand, { partial: true }).mockImplementation(async () => {
    const file = settingsFile(configHome);
    settingsAtInit = JSON.parse(vol.readFileSync(file, 'utf8') as string);
    vol.writeFileSync(file, JSON.stringify({ version: 1, init: { skipOnboarding: false } }));
    return {};
  });
});

describe('sandbox init', () => {
  it('runs with fresh settings while preserving template flags and the registry environment', async () => {
    const registry = 'http://localhost:6001/';

    await sbInit(
      resolve('project'),
      { XDG_CONFIG_HOME: personalConfig, npm_config_registry: registry },
      ['--no-dev', '--package-manager=yarn2']
    );

    expect(execaCommand).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('--yes --no-dev --package-manager=yarn2'),
      expect.objectContaining({
        env: expect.objectContaining({
          XDG_CONFIG_HOME: configHome,
          npm_config_registry: registry,
        }),
      })
    );
    expect(settingsAtInit).toEqual({ version: 1 });
    expect(vol.readFileSync(settingsFile(personalConfig), 'utf8')).toBe(personalSettings);
    expect(vol.existsSync(configHome)).toBe(false);
  });

  it('cleans up the settings directory when init fails', async () => {
    const error = new Error('init failed');
    vi.mocked(execaCommand).mockRejectedValueOnce(error);

    await expect(sbInit(resolve('project'))).rejects.toBe(error);

    expect(vol.existsSync(configHome)).toBe(false);
  });

  it('cleans up and skips init when the settings file cannot be seeded', async () => {
    const error = new Error('write failed');
    vi.mocked(fs.writeFile).mockRejectedValueOnce(error);

    await expect(sbInit(resolve('project'))).rejects.toBe(error);

    expect(execaCommand).not.toHaveBeenCalled();
    expect(vol.existsSync(configHome)).toBe(false);
  });
});
