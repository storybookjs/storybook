import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeFileWithRetry } from './write-file-with-retry';

vi.mock('node:fs/promises');

describe('writeFileWithRetry', () => {
  const filename: string = 'foo.txt';

  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  it('can write to the file', async () => {
    await writeFileWithRetry(filename, 'foo', { encoding: 'ascii' });

    expect(fs.writeFile).toHaveBeenCalledExactlyOnceWith(filename, 'foo', {
      encoding: 'ascii',
    });
  });

  it('does not retry for errors without a code', async () => {
    const error = Object.assign(new Error('EBUSY but no code'));
    vi.mocked(fs.writeFile).mockRejectedValueOnce(error);

    await expect(writeFileWithRetry(filename, 'foo', { encoding: 'utf8' })).rejects.toThrow(error);

    expect(fs.writeFile).toHaveBeenCalledExactlyOnceWith(filename, 'foo', {
      encoding: 'utf8',
    });
  });

  it('does not retry for non-EBUSY errors', async () => {
    const error = Object.assign(new Error('denied'), { code: 'EPERM' });
    vi.mocked(fs.writeFile).mockRejectedValueOnce(error);

    await expect(writeFileWithRetry(filename, 'foo', {})).rejects.toThrow(error);

    expect(fs.writeFile).toHaveBeenCalledExactlyOnceWith(filename, 'foo', {});
  });

  it('retries for EBUSY errors', async () => {
    const error = Object.assign(new Error('locked'), { code: 'EBUSY' });
    vi.mocked(fs.writeFile)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error);

    let complete = false;
    const result = writeFileWithRetry(filename, 'foo', { flush: true }).finally(
      () => (complete = true)
    );

    await Promise.resolve();

    // The first four attempts fail.
    for (let i = 1; i <= 4; i++) {
      expect(fs.writeFile).toHaveBeenCalledTimes(i);
      expect(fs.writeFile).toHaveBeenNthCalledWith(i, filename, 'foo', { flush: true });
      expect(complete).toBe(false);
      await vi.advanceTimersByTimeAsync(100);
    }

    // The fifth attempt succeeds.
    expect(fs.writeFile).toHaveBeenCalledTimes(5);
    expect(fs.writeFile).toHaveBeenNthCalledWith(5, filename, 'foo', { flush: true });
    expect(complete).toBe(true);

    // Verify that the Promise resolves.
    await expect(result).resolves.toBeUndefined();
  });

  it('throws when EBUSY errors constantly occur', async () => {
    const error = Object.assign(new Error('locked'), { code: 'EBUSY' });
    vi.mocked(fs.writeFile).mockRejectedValue(error);

    const result = writeFileWithRetry(filename, 'foo', { flag: 'w' });

    // All five attempts fail.
    for (let i = 1; i <= 5; i++) {
      if (i > 1) {
        await vi.advanceTimersByTimeAsync(100);
      }

      expect(fs.writeFile).toHaveBeenCalledTimes(i);
      expect(fs.writeFile).toHaveBeenNthCalledWith(i, filename, 'foo', { flag: 'w' });
    }

    // There should not be a delay after the final attempt.
    expect(vi.getTimerCount()).toBe(0);

    await expect(result).rejects.toThrowError(error);
  });
});
