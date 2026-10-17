import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';
import { logger } from 'storybook/internal/node-logger';

import { createFileSystemCache } from './file-cache.ts';

// Spy-only mocks: keep the real module shapes and redirect fs calls to `memfs`, so disk state
// stays scoped to `vol`. Individual tests override a single spy to simulate a file system failure.
vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

// A non-EBUSY error so writeFileWithRetry rejects immediately without retrying.
const fsError = Object.assign(new Error('OPEN: operation not permitted'), { code: 'EPERM' });

describe('FileSystemCache', () => {
  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');

    vi.mocked(mkdirSync).mockImplementation(memfs.fs.mkdirSync);
    vi.mocked(writeFileSync).mockImplementation(memfs.fs.writeFileSync);
    vi.mocked(readFileSync).mockImplementation(memfs.fs.readFileSync);
    vi.mocked(readdirSync).mockImplementation(memfs.fs.readdirSync);
    vi.mocked(rmSync).mockImplementation(memfs.fs.rmSync);

    vi.mocked(mkdir).mockImplementation(memfs.fs.promises.mkdir as unknown as typeof mkdir);
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vi.mocked(readdir).mockImplementation(memfs.fs.promises.readdir as unknown as typeof readdir);
    vi.mocked(rm).mockImplementation(memfs.fs.promises.rm as unknown as typeof rm);

    vi.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vol.reset();
  });

  it('does not throw when the cache directory cannot be created', () => {
    vi.mocked(mkdirSync).mockImplementationOnce(() => {
      throw fsError;
    });

    expect(() => createFileSystemCache({ ns: 'test', basePath: '/cache' })).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('create the cache directory')
    );
  });

  it('degrades gracefully when an async write fails', async () => {
    vi.mocked(writeFile).mockRejectedValueOnce(fsError);
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    await expect(cache.set('key', { some: 'value' })).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('write cache entry "key"'));
  });

  it('degrades gracefully when a sync write fails', () => {
    vi.mocked(writeFileSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    expect(() => cache.setSync('key', { some: 'value' })).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('write cache entry "key"'));
  });

  it('returns the fallback when a read fails', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(fsError);
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    await expect(cache.get('missing', 'fallback')).resolves.toBe('fallback');
  });

  it('returns the fallback when a sync read fails', () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    expect(cache.getSync('missing', 'fallback')).toBe('fallback');
  });

  it('returns an empty list when listing cache entries fails', async () => {
    vi.mocked(readdir).mockRejectedValueOnce(fsError);
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    await expect(cache.getAll()).resolves.toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('read cache entries'));
  });

  it('returns an empty list when reading a cache entry fails', async () => {
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });
    await cache.set('key', { some: 'value' });
    vi.mocked(readFile).mockRejectedValueOnce(fsError);

    await expect(cache.getAll()).resolves.toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('read cache entries'));
  });

  it('does not throw when removing an entry fails', async () => {
    vi.mocked(rm).mockRejectedValueOnce(fsError);
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    await expect(cache.remove('key')).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('remove cache entry "key"'));
  });

  it('does not throw when removing an entry synchronously fails', () => {
    vi.mocked(rmSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    expect(() => cache.removeSync('key')).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('remove cache entry "key"'));
  });

  it('does not throw when clearing the cache fails', async () => {
    vi.mocked(readdir).mockRejectedValueOnce(fsError);
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    await expect(cache.clear()).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('clear the cache'));
  });

  it('does not throw when clearing the cache synchronously fails', () => {
    vi.mocked(readdirSync).mockImplementationOnce(() => {
      throw fsError;
    });
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    expect(() => cache.clearSync()).not.toThrow();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('clear the cache'));
  });

  it('still writes successfully when the file system is healthy', async () => {
    const cache = createFileSystemCache({ ns: 'test', basePath: '/cache' });

    await cache.set('key', { some: 'value' });

    expect(writeFile).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
