import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileSystemCache } from './file-cache';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('FileSystemCache', () => {
  let cache: FileSystemCache;

  beforeEach(async () => {
    cache = new FileSystemCache({ prefix: 'test', basePath: __dirname });
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe('set', () => {
    it('can set values', async () => {
      // The directory should have been created when the cache was created.
      expect(fs.mkdirSync).toHaveBeenCalledWith(__dirname, { recursive: true });

      await cache.set('foo', 'bar');

      expect(fsPromises.writeFile).toHaveBeenCalledExactlyOnceWith(
        path.join(
          __dirname,
          // 'test-[sha256 hash of "foo" in hex]'
          'test-2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
        ),
        expect.stringContaining('"content":"bar"'),
        { encoding: 'utf8' }
      );
    });

    it('does not retry for errors without a code', async () => {
      const error = Object.assign(new Error('EBUSY but no code'));
      vi.mocked(fsPromises.writeFile).mockRejectedValueOnce(error);

      await expect(cache.set('foo', 'bar')).rejects.toThrow(error);
    });

    it('does not retry for non-EBUSY errors', async () => {
      const error = Object.assign(new Error('denied'), { code: 'EPERM' });
      vi.mocked(fsPromises.writeFile).mockRejectedValueOnce(error);

      await expect(cache.set('foo', 'bar')).rejects.toThrow(error);
    });

    it('retries for EBUSY errors', async () => {
      const error = Object.assign(new Error('locked'), { code: 'EBUSY' });
      vi.mocked(fsPromises.writeFile)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      let complete = false;
      const result = cache.set('foo', 'bar').finally(() => (complete = true));

      await Promise.resolve();

      // The first four attempts fail.
      for (let i = 1; i <= 4; i++) {
        expect(fsPromises.writeFile).toHaveBeenCalledTimes(i);
        expect(complete).toBe(false);
        await vi.advanceTimersByTimeAsync(100);
      }

      // The fifth attempt succeeds.
      expect(fsPromises.writeFile).toHaveBeenCalledTimes(5);
      expect(complete).toBe(true);

      // Verify that the Promise resolves.
      await expect(result).resolves.toBeUndefined();
    });

    it('throws when EBUSY errors constantly occur', async () => {
      const error = Object.assign(new Error('locked'), { code: 'EBUSY' });
      vi.mocked(fsPromises.writeFile).mockRejectedValue(error);

      const result = cache.set('foo', 'bar');

      // All five attempts fail.
      for (let i = 1; i <= 5; i++) {
        if (i === 1) {
          await Promise.resolve();
        } else {
          await vi.advanceTimersByTimeAsync(100);
        }

        expect(fsPromises.writeFile).toHaveBeenCalledTimes(i);
      }

      // There should not be a delay after the final attempt.
      expect(vi.getTimerCount()).toBe(0);

      await expect(result).rejects.toThrowError(error);
    });
  });
});
