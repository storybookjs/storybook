/**
 * Preview decorator - wraps stories in React Profiler
 * Collects render timing, re-render counts, and web vitals
 */

import * as React from 'react';
import { useEffect, useRef, useCallback } from 'react';
import { addons, useParameter } from 'storybook/preview-api';
import type { DecoratorFunction } from 'storybook/internal/types';
import { EVENTS, PARAM_KEY } from './constants';
import type { ProfilerData, PerformanceMetrics, PerformanceParameters } from './types';

// Track metrics per story (including CLS and longTaskCount per story)
const storyMetrics = new Map<
  string,
  {
    renderCount: number;
    metrics: PerformanceMetrics;
    clsValue: number;
    longTaskCount: number;
  }
>();

// Performance Observer for web vitals
let performanceObserver: PerformanceObserver | null = null;
let currentStoryId: string | null = null;

/**
 * Initialize Performance Observer for CLS and long tasks
 */
function initPerformanceObserver(storyId: string, emit: (data: PerformanceMetrics) => void) {
  // Clean up previous observer
  if (performanceObserver) {
    performanceObserver.disconnect();
  }

  // Track which story we're observing
  currentStoryId = storyId;

  // Initialize per-story metrics if not exists
  const storyState = storyMetrics.get(storyId);
  if (storyState) {
    storyState.clsValue = 0;
    storyState.longTaskCount = 0;
  }

  if (typeof PerformanceObserver === 'undefined') {
    return;
  }

  try {
    performanceObserver = new PerformanceObserver((entryList) => {
      // Use currentStoryId to ensure we're updating the right story
      const activeStoryId = currentStoryId;
      if (!activeStoryId) return;

      const current = storyMetrics.get(activeStoryId);
      if (!current) return;

      for (const entry of entryList.getEntries()) {
        // Track layout shifts for CLS
        if (entry.entryType === 'layout-shift') {
          const layoutShift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!layoutShift.hadRecentInput && layoutShift.value) {
            current.clsValue += layoutShift.value;
          }
        }

        // Track long tasks (>50ms)
        if (entry.entryType === 'longtask') {
          current.longTaskCount++;
        }
      }

      // Emit updated metrics from per-story state
      current.metrics = {
        cls: current.clsValue,
        longTaskCount: current.longTaskCount,
      };
      emit(current.metrics);
    });

    // Observe layout shifts
    try {
      performanceObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // layout-shift not supported
    }

    // Observe long tasks
    try {
      performanceObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask not supported
    }
  } catch {
    // PerformanceObserver not fully supported
  }
}

/**
 * Cleanup Performance Observer
 */
function cleanupPerformanceObserver() {
  if (performanceObserver) {
    performanceObserver.disconnect();
    performanceObserver = null;
  }
}

/**
 * React component that wraps the story in a Profiler
 */
interface ProfilerWrapperProps {
  storyId: string;
  storyFn: () => React.ReactNode;
}

function ProfilerWrapper({ storyId, storyFn }: ProfilerWrapperProps) {
  const channel = addons.getChannel();
  const mountedRef = useRef(false);
  const lastPhaseRef = useRef<string | null>(null);

  // Initialize or get metrics for this story
  useEffect(() => {
    if (!storyMetrics.has(storyId)) {
      storyMetrics.set(storyId, {
        renderCount: 0,
        metrics: { cls: 0, longTaskCount: 0 },
        clsValue: 0,
        longTaskCount: 0,
      });
    }

    // Setup performance observer
    initPerformanceObserver(storyId, (metrics) => {
      channel.emit(EVENTS.METRICS, { storyId, metrics });
    });

    return () => {
      cleanupPerformanceObserver();
    };
  }, [storyId, channel]);

  // Profiler callback
  const onRender = useCallback(
    (
      id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      const current = storyMetrics.get(storyId);
      if (!current) return;

      current.renderCount++;

      const profilerData: ProfilerData = {
        id: storyId,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        timestamp: Date.now(),
      };

      // Emit render event
      channel.emit(EVENTS.RENDER, {
        storyId,
        data: profilerData,
        renderCount: current.renderCount,
        isRerender: phase !== 'mount' && mountedRef.current,
      });

      // Track that we've mounted
      if (phase === 'mount') {
        mountedRef.current = true;
      }

      // If this is an update after mount, it's a re-render
      if (phase !== 'mount' && mountedRef.current && lastPhaseRef.current !== null) {
        channel.emit(EVENTS.RERENDER, {
          storyId,
          data: profilerData,
          rerenderCount: current.renderCount - 1,
        });
      }

      lastPhaseRef.current = phase;
    },
    [storyId, channel]
  );

  // Render the story inside a Profiler
  return React.createElement(
    React.Profiler,
    {
      id: storyId,
      onRender,
    },
    storyFn()
  );
}

/**
 * Performance decorator for Storybook
 */
export const withPerformance: DecoratorFunction = (storyFn, context) => {
  const parameters = useParameter<PerformanceParameters>(PARAM_KEY, {}) ?? {};

  // Skip if disabled via parameters
  if (parameters?.disable) {
    return storyFn();
  }

  return React.createElement(ProfilerWrapper, {
    storyId: context.id,
    storyFn: () => storyFn(),
  });
};

// Handle clear event from manager (with HMR guard)
let listenersRegistered = false;

function registerChannelListeners() {
  if (typeof window === 'undefined' || listenersRegistered) {
    return;
  }

  try {
    const channel = addons.getChannel();

    channel.on(EVENTS.CLEAR, () => {
      storyMetrics.clear();
      currentStoryId = null;
    });

    channel.on(EVENTS.REQUEST_STATE, ({ storyId }: { storyId: string }) => {
      const data = storyMetrics.get(storyId);
      if (data) {
        channel.emit(EVENTS.STATE, { storyId, ...data });
      }
    });

    listenersRegistered = true;
  } catch {
    // Channel not available yet
  }
}

registerChannelListeners();

// Export decorators array for preset
export const decorators = [withPerformance];
