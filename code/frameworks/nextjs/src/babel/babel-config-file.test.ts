import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BABEL_CONFIG_FILES, findBabelConfigFile } from './babel-config-file.ts';

describe('findBabelConfigFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sb-nextjs-babel-config-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it.each(BABEL_CONFIG_FILES)('finds %s', async (file) => {
    await writeFile(join(dir, file), '');

    expect(findBabelConfigFile(dir)).toBe(join(dir, file));
  });

  it('returns undefined when there is no Babel config', () => {
    expect(findBabelConfigFile(dir)).toBeUndefined();
  });

  it('ignores config file names that Next.js ignores', async () => {
    await writeFile(join(dir, 'babel.config.cts'), '');

    expect(findBabelConfigFile(dir)).toBeUndefined();
  });

  it('prefers .babelrc over babel.config.js, like Next.js', async () => {
    await writeFile(join(dir, 'babel.config.js'), '');
    await writeFile(join(dir, '.babelrc'), '');

    expect(findBabelConfigFile(dir)).toBe(join(dir, '.babelrc'));
  });
});
