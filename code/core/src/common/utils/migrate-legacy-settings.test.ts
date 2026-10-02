import { access, cp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateLegacySettings } from './migrate-legacy-settings.ts';

vi.mock('node:fs/promises');

const legacyDir = join(homedir(), '.storybook');
const legacySettingsPath = join(legacyDir, 'settings.json');
const enoent = Object.assign(new Error(), { code: 'ENOENT' });

/** `access` resolves for the given paths and rejects for everything else. */
function existingPaths(...paths: string[]) {
  vi.mocked(access).mockImplementation(async (path) =>
    paths.includes(path as string) ? undefined : Promise.reject(enoent)
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('migrateLegacySettings', () => {
  it('does nothing when XDG_CONFIG_HOME is not set', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', undefined);
    existingPaths(legacySettingsPath);

    await migrateLegacySettings();

    expect(cp).not.toHaveBeenCalled();
  });

  it('copies settings.json to the XDG config dir', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/config');
    existingPaths(legacySettingsPath);

    await migrateLegacySettings();

    expect(cp).toHaveBeenCalledWith(
      legacySettingsPath,
      join('/tmp/config', 'storybook', 'settings.json')
    );
  });

  it('does not overwrite an existing destination file', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/config');
    existingPaths(legacySettingsPath, join('/tmp/config', 'storybook', 'settings.json'));

    await migrateLegacySettings();

    expect(cp).not.toHaveBeenCalled();
  });

  it('does nothing when there is no legacy settings.json', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/config');
    existingPaths();

    await migrateLegacySettings();

    expect(cp).not.toHaveBeenCalled();
  });
});
