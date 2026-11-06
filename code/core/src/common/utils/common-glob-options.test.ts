import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { expandDirectoryPattern } from './common-glob-options.ts';

vi.mock('node:fs', { spy: true });

describe('expandDirectoryPattern', () => {
  beforeEach(async () => {
    vol.reset();
    vol.fromNestedJSON({ '/project/src/(group)/Button.stories.ts': '' });
    const fs = await import('node:fs');
    vi.mocked(fs.statSync).mockImplementation(memfs.fs.statSync as typeof fs.statSync);
  });

  it('expands patterns that name an existing directory', () => {
    const patterns = ['src', 'src/', './src/(group)', '!src', '/project/src'];

    expect(patterns.map((pattern) => expandDirectoryPattern(pattern, '/project'))).toEqual([
      'src/**',
      'src/**',
      'src/(group)/**',
      '!src/**',
      '/project/src/**',
    ]);
  });

  it('keeps glob patterns, files and missing paths as they are', () => {
    const patterns = ['**/*.stories.ts', 'src/(group)/Button.stories.ts', 'missing'];

    expect(patterns.map((pattern) => expandDirectoryPattern(pattern, '/project'))).toEqual(
      patterns
    );
  });
});
