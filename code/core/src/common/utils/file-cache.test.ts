import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { createFileSystemCache } from './file-cache.ts';

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('storybook/internal/node-logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// A non-EBUSY error so writeFileWithRetry rejects immediately without retrying.
const fsError = Object.assign(new Error('OPEN: operation not permitted'), { code: 'EPERM' });

describe('FileSystemCache', () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(readFile).mockResolvedValue('{}');
    vi.mocked(readdir).mockResolvedValue([]);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when the cache directory cannot be created', () => {
    vi.mocked(mkdirSync).mockImplementationOnce(() => {
      throw fsError;
    });

    expect(() => createFileSystemCache({ ns: 'test' })).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('create the cache directory')
    );
  });

  it('degrades gracefully when an async write fails', async () => {
    vi.mocked(writeFile).mockRejectedValue(fsError);
    const cache = createFileSystemCache({ ns: 'test' });

    await expect(cache.set('key', { some: 'value' })).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('write cache entry "key"'));
  });

  it('degrades gracefully when a sync write fails', () => {
    vi.mocked(writeFileSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test' });

    expect(() => cache.setSync('key', { some: 'value' })).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('write cache entry "key"'));
  });

  it('returns the fallback when a read fails', async () => {
    vi.mocked(readFile).mockRejectedValue(fsError);
    const cache = createFileSystemCache({ ns: 'test' });

    await expect(cache.get('missing', 'fallback')).resolves.toBe('fallback');
  });

  it('returns the fallback when a sync read fails', () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test' });

    expect(cache.getSync('missing', 'fallback')).toBe('fallback');
  });

  it('returns an empty list when reading all entries fails', async () => {
    vi.mocked(readdir).mockRejectedValue(fsError);
    const cache = createFileSystemCache({ ns: 'test' });

    await expect(cache.getAll()).resolves.toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('read cache entries'));
  });

  it('does not throw when removing an entry fails', async () => {
    vi.mocked(rm).mockRejectedValue(fsError);
    const cache = createFileSystemCache({ ns: 'test' });

    await expect(cache.remove('key')).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('remove cache entry "key"'));
  });

  it('does not throw when clearing the cache fails', async () => {
    vi.mocked(readdir).mockRejectedValue(fsError);
    const cache = createFileSystemCache({ ns: 'test' });

    await expect(cache.clear()).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('clear the cache'));
  });

  it('does not throw when clearing the cache synchronously fails', () => {
    vi.mocked(readdirSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test' });

    expect(() => cache.clearSync()).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('clear the cache'));
  });

  it('still writes successfully when the file system is healthy', async () => {
    const cache = createFileSystemCache({ ns: 'test' });

    await cache.set('key', { some: 'value' });

    expect(writeFile).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
