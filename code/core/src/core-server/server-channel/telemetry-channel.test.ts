import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SIDEBAR_FILTER_CHANGED } from 'storybook/internal/core-events';

import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import { initTelemetryChannel, makePayload } from './telemetry-channel.ts';

vi.mock('storybook/internal/telemetry', () => ({
  telemetry: vi.fn(),
  getLastEvents: vi.fn().mockResolvedValue({}),
  getSessionId: vi.fn().mockResolvedValue('test-session-id'),
  isTelemetryModuleEnabled: vi.fn().mockReturnValue(true),
  setTelemetryEnabled: vi.fn(),
}));

const { telemetry } = await import('storybook/internal/telemetry');

describe('telemetry-channel', () => {
  describe('SIDEBAR_FILTER_CHANGED', () => {
    it('forwards sidebar-filter event to telemetry', () => {
      const listeners: Record<string, Function> = {};
      const channel = {
        on: (event: string, listener: Function) => {
          listeners[event] = listener;
        },
      } as any;

      initTelemetryChannel(channel);

      const payload = {
        trigger: 'interaction' as const,
        changed: {
          filterType: 'status' as const,
          filterId: 'status-value:new',
          action: 'include' as const,
        },
        activeTagFilters: { included: [], excluded: [] },
        activeStatusFilters: { included: ['status-value:new'], excluded: [] },
        storyCounts: { 'status-value:new': 3 },
      };

      listeners[SIDEBAR_FILTER_CHANGED](payload);
      expect(telemetry).toHaveBeenCalledWith('sidebar-filter', payload);
    });
  });

  describe('REVIEW_EVENTS.PAGEVIEW', () => {
    it('forwards review summary pageview to telemetry', () => {
      const listeners: Record<string, Function> = {};
      const channel = {
        on: (event: string, listener: Function) => {
          listeners[event] = listener;
        },
      } as any;

      initTelemetryChannel(channel);

      listeners[REVIEW_EVENTS.PAGEVIEW]({ page: 'summary', reviewCreatedAt: 1700000000000 });
      expect(telemetry).toHaveBeenCalledWith('review', {
        action: 'pageview',
        source: 'mcp-review',
        page: 'summary',
        reviewCreatedAt: 1700000000000,
      });
    });

    it('forwards review detail pageview to telemetry', () => {
      const listeners: Record<string, Function> = {};
      const channel = {
        on: (event: string, listener: Function) => {
          listeners[event] = listener;
        },
      } as any;

      initTelemetryChannel(channel);

      listeners[REVIEW_EVENTS.PAGEVIEW]({ page: 'detail', reviewCreatedAt: 1700000000000 });
      expect(telemetry).toHaveBeenCalledWith('review', {
        action: 'pageview',
        source: 'mcp-review',
        page: 'detail',
        reviewCreatedAt: 1700000000000,
      });
    });
  });
});

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
