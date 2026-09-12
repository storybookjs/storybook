import { access, cp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateLegacyStorybookDir } from './migrate-legacy-storybook-dir.ts';

vi.mock('node:fs/promises');

const legacyDir = join(homedir(), '.storybook');
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

describe('migrateLegacyStorybookDir', () => {
  it('does nothing when neither XDG variable is set', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', undefined);
    vi.stubEnv('XDG_STATE_HOME', undefined);
    existingPaths(join(legacyDir, 'settings.json'), join(legacyDir, 'instances'));

    await migrateLegacyStorybookDir();

    expect(cp).not.toHaveBeenCalled();
  });

  it('copies settings.json to the XDG config dir', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/config');
    vi.stubEnv('XDG_STATE_HOME', undefined);
    existingPaths(join(legacyDir, 'settings.json'));

    await migrateLegacyStorybookDir();

    expect(cp).toHaveBeenCalledWith(
      join(legacyDir, 'settings.json'),
      join('/tmp/config', 'storybook', 'settings.json'),
      { recursive: true }
    );
  });

  it('copies the instances dir to the XDG state dir', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', undefined);
    vi.stubEnv('XDG_STATE_HOME', '/tmp/state');
    existingPaths(join(legacyDir, 'instances'));

    await migrateLegacyStorybookDir();

    expect(cp).toHaveBeenCalledWith(
      join(legacyDir, 'instances'),
      join('/tmp/state', 'storybook', 'instances'),
      { recursive: true }
    );
  });

  it('skips copying when the target dir already exists', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/config');
    existingPaths(join(legacyDir, 'settings.json'), join('/tmp/config', 'storybook'));

    await migrateLegacyStorybookDir();

    expect(cp).not.toHaveBeenCalled();
  });

  it('does nothing when the legacy dir has no matching entries', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', '/tmp/config');
    vi.stubEnv('XDG_STATE_HOME', '/tmp/state');
    existingPaths();

    await migrateLegacyStorybookDir();

    expect(cp).not.toHaveBeenCalled();
  });
});
