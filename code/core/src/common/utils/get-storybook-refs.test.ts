import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRef } from './get-storybook-refs.ts';

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
    // Fake timers do not drive `AbortSignal.timeout`, so its signal is stubbed and aborted by hand.
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const pending = checkRef('https://chromatic.com');
    controller.abort(new DOMException('timed out', 'TimeoutError'));
    expect(await pending).toBe(false);
    expect(timeoutSpy).toHaveBeenCalledWith(3_000);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://chromatic.com/iframe.html',
      expect.objectContaining({ signal: controller.signal })
    );
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
