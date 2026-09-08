import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach } from 'node:test';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Settings, _clearGlobalSettings, globalSettings } from './globalSettings.ts';

const legacySettingsPath = join(homedir(), '.storybook', 'settings.json');

vi.mock('node:fs');
vi.mock('node:fs/promises');

const userSince = new Date();
const baseSettings = { version: 1, userSince: +userSince };
const baseSettingsJson = JSON.stringify(baseSettings, null, 2);

const TEST_SETTINGS_FILE = '/test/settings.json';

beforeEach(() => {
  _clearGlobalSettings();

  vi.useFakeTimers();
  vi.setSystemTime(userSince);

  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('globalSettings', () => {
  it('loads settings when called for the first time', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    const settings = await globalSettings(TEST_SETTINGS_FILE);

    expect(settings.value.userSince).toBe(+userSince);
  });

  it('does nothing if settings are already loaded', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
    await globalSettings(TEST_SETTINGS_FILE);

    vi.mocked(fs.readFile).mockClear();
    await globalSettings(TEST_SETTINGS_FILE);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('does not save settings if they exist', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    await globalSettings(TEST_SETTINGS_FILE);

    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('saves settings and creates directory if they do not exist', async () => {
    const error = new Error() as Error & { code: string };
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await globalSettings(TEST_SETTINGS_FILE);

    expect(fs.mkdir).toHaveBeenCalledWith(dirname(TEST_SETTINGS_FILE), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, baseSettingsJson);
  });
});

describe('globalSettings default path', () => {
  const enoent = Object.assign(new Error(), { code: 'ENOENT' });

  it('reads from ~/.storybook/settings.json when XDG_CONFIG_HOME is not set', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', undefined);
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    await globalSettings();

    expect(fs.readFile).toHaveBeenCalledWith(legacySettingsPath, 'utf8');
  });

  it('reads from $XDG_CONFIG_HOME/storybook/settings.json when it is set', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg-config');
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    await globalSettings();

    expect(fs.readFile).toHaveBeenCalledWith(
      join('/tmp/xdg-config', 'storybook', 'settings.json'),
      'utf8'
    );
  });

  describe('legacy migration', () => {
    const xdgPath = join('/tmp/xdg-config', 'storybook', 'settings.json');

    it('moves an existing ~/.storybook/settings.json to the XDG location', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg-config');

      vi.mocked(fs.readFile).mockImplementation(async (path) =>
        path === legacySettingsPath || path === xdgPath ? baseSettingsJson : Promise.reject(enoent)
      );

      const settings = await globalSettings();

      expect(fs.writeFile).toHaveBeenCalledWith(xdgPath, baseSettingsJson, { flag: 'wx' });
      expect(settings.value.userSince).toBe(+userSince);
    });

    it('does not overwrite an existing target file', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg-config');
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
      // exclusive write rejects because the file is already there
      vi.mocked(fs.writeFile).mockRejectedValueOnce(Object.assign(new Error(), { code: 'EEXIST' }));

      const settings = await globalSettings();

      expect(settings.value.userSince).toBe(+userSince);
    });

    it('does not migrate when there is no legacy file', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg-config');
      vi.mocked(fs.readFile).mockRejectedValue(enoent);

      await globalSettings();

      // only the fresh-settings save, never a copy of legacy content
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(xdgPath, baseSettingsJson);
    });

    it('does not migrate when XDG_CONFIG_HOME is not set', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', undefined);
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

      await globalSettings();

      // just the normal load from the legacy path, no extra migration read or write
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('does not migrate into an explicit file path', async () => {
      vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg-config');
      vi.mocked(fs.readFile).mockImplementation(async (path) =>
        path === legacySettingsPath ? baseSettingsJson : Promise.reject(enoent)
      );

      await globalSettings('/custom/settings.json');

      // legacy content is never read or copied into the caller's path
      expect(fs.readFile).not.toHaveBeenCalledWith(legacySettingsPath, 'utf8');
      expect(fs.writeFile).not.toHaveBeenCalledWith('/custom/settings.json', baseSettingsJson, {
        flag: 'wx',
      });
    });
  });
});

describe('Settings', () => {
  let settings: Settings;
  beforeEach(async () => {
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    settings = await globalSettings(TEST_SETTINGS_FILE);
  });

  describe('save', () => {
    it('overwrites existing settings', async () => {
      settings.value.init = { skipOnboarding: true };
      await settings.save();

      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_SETTINGS_FILE,
        JSON.stringify({ ...baseSettings, init: { skipOnboarding: true } }, null, 2)
      );
    });

    it('logs warning if write fails', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write error'));

      await expect(settings.save()).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(
        'Unable to save global settings file to /test/settings.json\nReason: Write error'
      );
    });

    it('logs warning if directory creation fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Directory creation error'));

      await expect(settings.save()).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(
        'Unable to save global settings file to /test/settings.json\nReason: Directory creation error'
      );
    });
  });
});
