import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makePayload } from './telemetry-channel';

describe('makePayload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('new user init session', () => {
    const userAgent = 'Mozilla/5.0';
    const sessionId = 'session-123';
    const lastInit = {
      timestamp: Date.now() - 3000,
      body: {
        sessionId,
        payload: { newUser: true },
      },
    };

    expect(makePayload(userAgent, lastInit as any, sessionId)).toMatchInlineSnapshot(`
      {
        "isNewUser": true,
        "timeSinceInit": 3000,
        "userAgent": "Mozilla/5.0",
      }
    `);
  });

  it('existing user init session', () => {
    const userAgent = 'Mozilla/5.0';
    const sessionId = 'session-123';
    const lastInit = {
      timestamp: Date.now() - 3000,
      body: {
        sessionId,
        payload: {},
      },
    };

    expect(makePayload(userAgent, lastInit as any, sessionId)).toMatchInlineSnapshot(`
      {
        "isNewUser": false,
        "timeSinceInit": 3000,
        "userAgent": "Mozilla/5.0",
      }
    `);
  });

  it('no init session', () => {
    const userAgent = 'Mozilla/5.0';
    const sessionId = 'session-123';
    const lastInit = undefined;

    expect(makePayload(userAgent, lastInit, sessionId)).toMatchInlineSnapshot(`
      {
        "isNewUser": false,
        "timeSinceInit": undefined,
        "userAgent": "Mozilla/5.0",
      }
    `);
  });

  it('init session with different sessionId', () => {
    const userAgent = 'Mozilla/5.0';
    const sessionId = 'session-123';
    const lastInit = {
      timestamp: Date.now() - 3000,
      body: {
        sessionId: 'session-456',
      },
    };

    expect(makePayload(userAgent, lastInit as any, sessionId)).toMatchInlineSnapshot(`
      {
        "isNewUser": false,
        "timeSinceInit": undefined,
        "userAgent": "Mozilla/5.0",
      }
    `);
  });
});
