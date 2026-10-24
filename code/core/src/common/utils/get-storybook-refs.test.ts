import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRef, getRefs } from './get-storybook-refs.ts';

// getAutoRefs walks upward from configDir looking for a package manifest to auto-discover refs
// from. Pin it to nothing so the test cannot pick up refs from the host filesystem.
vi.mock('empathic/package', () => ({ up: () => undefined }));

describe('checkRef', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns true when fetch returns 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
    expect(await checkRef('https://chromatic.com')).toBe(true);
  });

  it('returns false when fetch returns 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);
    expect(await checkRef('https://chromatic.com')).toBe(false);
  });

  it('returns false when fetch returns 200 with loginUrl', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ loginUrl: 'https://chromatic.com/login' }),
    } as Response);
    expect(await checkRef('https://chromatic.com')).toBe(false);
  });

  it('gives up on a ref that does not answer in time', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
          )
      );
    vi.useFakeTimers();
    try {
      const pending = checkRef('https://chromatic.com');
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await pending).toBe(false);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://chromatic.com/iframe.html',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns false when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    expect(await checkRef('https://chromatic.com')).toBe(false);
  });

  it('returns false when the JSON follow-up fetch fails after a 200 response', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await checkRef('https://chromatic.com')).toBe(false);
  });
});

describe('getRefs', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalizes camelCase ref keys to lowercase and drops the original entry', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);

    const refs = await getRefs({
      configDir: 'storybook-get-refs-config-dir',
      presets: {
        apply: async () => ({
          qaWorking: { title: 'QA', url: 'http://localhost:6007' },
        }),
      },
    } as unknown as Parameters<typeof getRefs>[0]);

    expect(Object.keys(refs)).toEqual(['qaworking']);
    expect(refs.qaworking).toMatchObject({
      id: 'qaworking',
      title: 'QA',
      url: 'http://localhost:6007',
    });
  });
});
