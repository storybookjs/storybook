import fs from 'node:fs/promises';
import { dirname } from 'node:path';
import { afterEach } from 'node:test';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Settings, _clearGlobalSettings, globalSettings } from './globalSettings';

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
