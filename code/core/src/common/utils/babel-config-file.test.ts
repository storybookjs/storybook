import { existsSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';
import { join } from 'pathe';

import { findBabelConfigFile } from './babel-config-file.ts';

vi.mock('node:fs', { spy: true });

const dir = '/project';

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
});

describe('findBabelConfigFile', () => {
  it.each([
    '.babelrc',
    '.babelrc.json',
    '.babelrc.js',
    '.babelrc.mjs',
    '.babelrc.cjs',
    'babel.config.js',
    'babel.config.json',
    'babel.config.mjs',
    'babel.config.cjs',
  ])('finds %s', (file) => {
    vol.fromJSON({ [join(dir, file)]: '' });

    expect(findBabelConfigFile(dir)).toBe(join(dir, file));
  });

  it('returns undefined when there is no Babel config', () => {
    vol.fromJSON({ [join(dir, 'package.json')]: '{}' });

    expect(findBabelConfigFile(dir)).toBeUndefined();
  });

  it('ignores other file names', () => {
    vol.fromJSON({ [join(dir, 'babel.config.cts')]: '' });

    expect(findBabelConfigFile(dir)).toBeUndefined();
  });

  it('prefers .babelrc over babel.config.js', () => {
    vol.fromJSON({ [join(dir, 'babel.config.js')]: '', [join(dir, '.babelrc')]: '' });

    expect(findBabelConfigFile(dir)).toBe(join(dir, '.babelrc'));
  });
});
