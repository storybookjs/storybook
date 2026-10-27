import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { findConfigFile } from './get-storybook-info.ts';

vi.mock('node:fs', { spy: true });

const configDir = join('/project', '.storybook');

describe('findConfigFile', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
  });

  it.each(['main.mts', 'main.cts', 'main.ts', 'main.js'])('finds %s', (file) => {
    vol.fromJSON({ [join(configDir, file)]: '' });

    expect(findConfigFile('main', configDir)).toBe(join(configDir, file));
  });

  it('returns null when there is no config file', () => {
    vol.fromJSON({ [join(configDir, 'preview.ts')]: '' });

    expect(findConfigFile('main', configDir)).toBeNull();
  });
});
