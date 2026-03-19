import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRef } from './get-storybook-refs';

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

  it('returns false when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    expect(await checkRef('https://chromatic.com')).toBe(false);
  });
});
