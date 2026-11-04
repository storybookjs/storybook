import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateLegacySettings } from '../common/utils/migrate-legacy-settings.ts';
import { type Settings, _clearGlobalSettings, globalSettings } from './globalSettings.ts';

const legacySettingsPath = join(homedir(), '.storybook', 'settings.json');

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('../common/utils/migrate-legacy-settings.ts');

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

describe('globalSettings validation', () => {
  const load = async (value: unknown) => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(value));
    return (await globalSettings(TEST_SETTINGS_FILE)).value;
  };

  it('keeps every known setting', async () => {
    const value = {
      version: 1,
      userSince: 123,
      init: { skipOnboarding: true },
      checklist: {
        items: {
          controls: { status: 'done', mutedAt: 456 },
          viewports: { status: 'skipped' },
          renderComponent: { mutedAt: 789 },
          writeInteractions: {},
        },
        widget: { disable: false },
      },
    };

    expect(await load(value)).toEqual(value);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('drops unknown keys outside checklist items', async () => {
    expect(
      await load({
        version: 2,
        future: true,
        init: { skipOnboarding: false, future: true },
        checklist: { future: true, items: { future: { status: 'done' } }, widget: { future: 1 } },
      })
    ).toEqual({
      version: 2,
      init: { skipOnboarding: false },
      checklist: { items: {}, widget: {} },
    });
  });

  it.each([
    ['a missing version', { userSince: 1 }],
    ['a wrongly typed setting', { version: 1, userSince: '1' }],
    ['a null setting', { version: 1, init: null }],
    [
      'an unknown checklist status',
      { version: 1, checklist: { items: { controls: { status: 'x' } } } },
    ],
    [
      'an unknown key in a checklist item',
      { version: 1, checklist: { items: { controls: { x: 1 } } } },
    ],
    ['a non-object file', [1]],
  ])('replaces a settings file with %s by fresh settings', async (_, value) => {
    expect(await load(value)).toEqual(baseSettings);
    expect(fs.writeFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, baseSettingsJson);
  });

  it('replaces a settings file that is not JSON by fresh settings', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{ not json');

    expect((await globalSettings(TEST_SETTINGS_FILE)).value).toEqual(baseSettings);
    expect(fs.writeFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, baseSettingsJson);
  });
});

describe('globalSettings default path', () => {
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

  it('migrates legacy settings when using the default path', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    await globalSettings();

    expect(migrateLegacySettings).toHaveBeenCalled();
  });

  it('does not migrate legacy settings for an explicit path', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    await globalSettings(TEST_SETTINGS_FILE);

    expect(migrateLegacySettings).not.toHaveBeenCalled();
  });

  it('logs a warning and still loads settings if the migration fails', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/xdg-config');
    vi.mocked(migrateLegacySettings).mockRejectedValue(new Error('Copy error'));
    vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

    const settings = await globalSettings();

    expect(settings.value.userSince).toBe(+userSince);
    expect(console.warn).toHaveBeenCalledWith(
      `Unable to migrate legacy global settings to ${join('/tmp/xdg-config', 'storybook', 'settings.json')}\nReason: Copy error`
    );
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
