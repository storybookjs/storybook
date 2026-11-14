import type { GlobOptions } from 'tinyglobby';
import { vi } from 'vitest';

/**
 * A `tinyglobby` whose `glob` walks the memfs volume instead of the disk. Use it as
 * `vi.mock('tinyglobby', async (importOriginal) => (await import('...')).memfsTinyglobby(importOriginal))`.
 */
export const memfsTinyglobby = async (
  importOriginal: () => Promise<typeof import('tinyglobby')>
) => {
  const actual = await importOriginal();
  const { fs } = await import('memfs');
  return {
    ...actual,
    glob: vi.fn(async (patterns: string | string[], options?: Omit<GlobOptions, 'patterns'>) => {
      const files = await actual.glob(patterns, { ...options, fs: fs as never });
      // On Windows, tinyglobby resolves a cwd without a drive, such as `/project`, to `C:/project`.
      // Such a test names its files `/project/...`, so the drive is left out again.
      const cwd = options?.cwd?.toString();
      return cwd && !/^[A-Za-z]:/.test(cwd)
        ? files.map((file) => file.replace(/^[A-Za-z]:/, ''))
        : files;
    }),
  };
};
