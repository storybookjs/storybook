// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_SETUP_ANALYTICS_REQUEST,
  GHOST_STORIES_REQUEST,
  PREVIEW_INITIALIZED,
} from 'storybook/internal/core-events';
import { global } from '@storybook/global';

vi.mock('storybook/manager-api', () => ({
  useStorybookApi: vi.fn(),
}));

import { useStorybookApi } from 'storybook/manager-api';
import { useDelayedAnalyticsTrigger } from './useDelayedAnalyticsTrigger.ts';

const mockUseStorybookApi = vi.mocked(useStorybookApi);

function createMockApi() {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    emit: vi.fn(),
    once: vi.fn((event: string, cb: (...args: any[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: (...args: any[]) => void) => {
      listeners.get(event)?.delete(cb);
    }),
    /** Helper to simulate an event firing. */
    _trigger(event: string) {
      listeners.get(event)?.forEach((cb) => cb());
    },
    _listeners: listeners,
  };
}

describe('useDelayedAnalyticsTrigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Simulate `sb ai setup` having been run in the same session so both the
    // AI opt-in gate and the session-match check pass.
    global.STORYBOOK_LAST_EVENTS = {
      'ai-setup': { body: { sessionId: undefined as any } as any, timestamp: Date.now() },
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (global as any).STORYBOOK_LAST_EVENTS;
  });

  it('registers a PREVIEW_INITIALIZED listener on mount', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    renderHook(() => useDelayedAnalyticsTrigger());

    expect(api.once).toHaveBeenCalledWith(PREVIEW_INITIALIZED, expect.any(Function));
  });

  it('does not emit events before PREVIEW_INITIALIZED fires', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    renderHook(() => useDelayedAnalyticsTrigger());

    vi.advanceTimersByTime(20 * 60 * 1000);
    expect(api.emit).not.toHaveBeenCalled();
  });

  it('emits GHOST_STORIES_REQUEST and AI_SETUP_ANALYTICS_REQUEST after delay', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    renderHook(() => useDelayedAnalyticsTrigger());

    api._trigger(PREVIEW_INITIALIZED);
    expect(api.emit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(api.emit).toHaveBeenCalledWith(GHOST_STORIES_REQUEST);
    expect(api.emit).toHaveBeenCalledWith(AI_SETUP_ANALYTICS_REQUEST);
    expect(api.emit).toHaveBeenCalledTimes(2);
  });

  it('does not emit before the 4-minute delay elapses', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    renderHook(() => useDelayedAnalyticsTrigger());

    api._trigger(PREVIEW_INITIALIZED);
    vi.advanceTimersByTime(3 * 60 * 1000);

    expect(api.emit).not.toHaveBeenCalled();
  });

  it('only fires once even if PREVIEW_INITIALIZED triggers multiple re-renders', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    const { rerender } = renderHook(() => useDelayedAnalyticsTrigger());

    api._trigger(PREVIEW_INITIALIZED);
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(api.emit).toHaveBeenCalledTimes(2);

    // Re-render and trigger again — should not fire again
    rerender();
    api._trigger(PREVIEW_INITIALIZED);
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(api.emit).toHaveBeenCalledTimes(2);
  });

  it('clears the timeout on unmount before it fires', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    const { unmount } = renderHook(() => useDelayedAnalyticsTrigger());

    api._trigger(PREVIEW_INITIALIZED);
    vi.advanceTimersByTime(2 * 60 * 1000);

    unmount();
    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(api.emit).not.toHaveBeenCalled();
  });

  it('unregisters the PREVIEW_INITIALIZED listener on unmount', () => {
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    const { unmount } = renderHook(() => useDelayedAnalyticsTrigger());

    expect(api.once).toHaveBeenCalledTimes(1);
    unmount();

    expect(api.off).toHaveBeenCalledWith(PREVIEW_INITIALIZED, expect.any(Function));
  });

  it('does not emit when neither ai-init-opt-in nor ai-setup events are present', () => {
    delete (global as any).STORYBOOK_LAST_EVENTS;
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    renderHook(() => useDelayedAnalyticsTrigger());

    api._trigger(PREVIEW_INITIALIZED);
    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(api.emit).not.toHaveBeenCalled();
  });

  it('does not emit ghost/setup analytics when only ai-init-opt-in is present (no same-session ai-setup)', () => {
    global.STORYBOOK_LAST_EVENTS = {
      'ai-init-opt-in': { body: {} as any, timestamp: Date.now() },
    } as any;
    const api = createMockApi();
    mockUseStorybookApi.mockReturnValue(api as any);

    renderHook(() => useDelayedAnalyticsTrigger());

    api._trigger(PREVIEW_INITIALIZED);
    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(api.emit).not.toHaveBeenCalled();
  });
});
