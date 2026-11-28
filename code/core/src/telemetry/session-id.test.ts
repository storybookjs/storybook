import type { MockInstance } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from 'storybook/internal/common';

import { nanoid } from 'nanoid';

import { SESSION_TIMEOUT, getSessionId, resetSessionIdForTest } from './session-id.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  cache: {
    getSync: vi.fn(),
    setSync: vi.fn(),
  },
}));
vi.mock('nanoid');

const spy = (x: any) => x as MockInstance;

describe('getSessionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionIdForTest();
  });

  it('returns existing sessionId when cached in memory and does not fetch from disk', async () => {
    const existingSessionId = 'memory-session-id';
    resetSessionIdForTest(existingSessionId);

    const sessionId = getSessionId();

    expect(cache.getSync).not.toHaveBeenCalled();
    expect(cache.setSync).toHaveBeenCalledTimes(1);
    expect(cache.setSync).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({ id: existingSessionId })
    );
    expect(sessionId).toBe(existingSessionId);
  });

  it('returns existing sessionId when cached on disk and not expired', async () => {
    const existingSessionId = 'existing-session-id';
    const existingSession = {
      id: existingSessionId,
      lastUsed: Date.now() - SESSION_TIMEOUT + 1000,
    };

    spy(cache.getSync).mockReturnValueOnce(existingSession);

    const sessionId = getSessionId();

    expect(cache.getSync).toHaveBeenCalledTimes(1);
    expect(cache.getSync).toHaveBeenCalledWith('session');
    expect(cache.setSync).toHaveBeenCalledTimes(1);
    expect(cache.setSync).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({ id: existingSessionId })
    );
    expect(sessionId).toBe(existingSessionId);
  });

  it('generates new sessionId when none exists', async () => {
    const newSessionId = 'new-session-id';
    (nanoid as unknown as MockInstance).mockReturnValueOnce(newSessionId);

    spy(cache.getSync).mockReturnValueOnce(undefined);

    const sessionId = getSessionId();

    expect(cache.getSync).toHaveBeenCalledTimes(1);
    expect(cache.getSync).toHaveBeenCalledWith('session');
    expect(nanoid).toHaveBeenCalledTimes(1);
    expect(cache.setSync).toHaveBeenCalledTimes(1);
    expect(cache.setSync).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({ id: newSessionId })
    );
    expect(sessionId).toBe(newSessionId);
  });

  it('generates new sessionId when existing one is expired', async () => {
    const expiredSessionId = 'expired-session-id';
    const expiredSession = { id: expiredSessionId, lastUsed: Date.now() - SESSION_TIMEOUT - 1000 };
    const newSessionId = 'new-session-id';
    spy(nanoid).mockReturnValueOnce(newSessionId);

    spy(cache.getSync).mockReturnValueOnce(expiredSession);

    const sessionId = getSessionId();

    expect(cache.getSync).toHaveBeenCalledTimes(1);
    expect(cache.getSync).toHaveBeenCalledWith('session');
    expect(nanoid).toHaveBeenCalledTimes(1);
    expect(cache.setSync).toHaveBeenCalledTimes(1);
    expect(cache.setSync).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({ id: newSessionId })
    );
    expect(sessionId).toBe(newSessionId);
  });
});

describe('getSessionId when the cache cannot be written', () => {
  it('still returns the session id', () => {
    resetSessionIdForTest('memory-session-id');
    spy(cache.setSync).mockImplementationOnce(() => {
      throw new Error('read-only');
    });

    expect(getSessionId()).toBe('memory-session-id');
  });
});
