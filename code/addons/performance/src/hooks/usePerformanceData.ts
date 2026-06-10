/**
 * Hook for consuming performance data from the channel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useChannel } from 'storybook/manager-api';
import { EVENTS } from '../constants';
import type { ProfilerData, PerformanceMetrics, StoryPerformanceData } from '../types';

const createEmptyData = (storyId: string): StoryPerformanceData => ({
  storyId,
  renderCount: 0,
  rerenderCount: 0,
  renders: [],
  metrics: { cls: 0, longTaskCount: 0 },
  avgRenderTime: 0,
  minRenderTime: 0,
  maxRenderTime: 0,
});

export function usePerformanceData(storyId: string | undefined) {
  const [data, setData] = useState<StoryPerformanceData | null>(null);
  const dataRef = useRef<StoryPerformanceData | null>(null);

  // Update ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Handle render events
  const handleRender = useCallback(
    (event: { storyId: string; data: ProfilerData; renderCount: number; isRerender: boolean }) => {
      if (event.storyId !== storyId) return;

      setData((prev) => {
        const current = prev || createEmptyData(event.storyId);
        const renders = [...current.renders, event.data];
        const durations = renders.map((r) => r.actualDuration);
        const total = durations.reduce((sum, d) => sum + d, 0);

        return {
          ...current,
          renderCount: event.renderCount,
          rerenderCount: event.isRerender ? current.rerenderCount + 1 : current.rerenderCount,
          renders,
          avgRenderTime: total / renders.length,
          minRenderTime: Math.min(...durations),
          maxRenderTime: Math.max(...durations),
          firstRender: current.firstRender || event.data.timestamp,
          lastRender: event.data.timestamp,
        };
      });
    },
    [storyId]
  );

  // Handle rerender events
  const handleRerender = useCallback(
    (event: { storyId: string; rerenderCount: number }) => {
      if (event.storyId !== storyId) return;

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rerenderCount: event.rerenderCount,
        };
      });
    },
    [storyId]
  );

  // Handle metrics updates
  const handleMetrics = useCallback(
    (event: { storyId: string; metrics: PerformanceMetrics }) => {
      if (event.storyId !== storyId) return;

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          metrics: event.metrics,
        };
      });
    },
    [storyId]
  );

  // Handle clear events
  const handleClear = useCallback(() => {
    if (storyId) {
      setData(createEmptyData(storyId));
    }
  }, [storyId]);

  // Subscribe to channel events
  const emit = useChannel({
    [EVENTS.RENDER]: handleRender,
    [EVENTS.RERENDER]: handleRerender,
    [EVENTS.METRICS]: handleMetrics,
    [EVENTS.CLEAR]: handleClear,
  });

  // Request state when story changes
  useEffect(() => {
    if (storyId) {
      setData(createEmptyData(storyId));
      emit(EVENTS.REQUEST_STATE, { storyId });
    }
  }, [storyId, emit]);

  // Clear function for button
  const clearData = useCallback(() => {
    emit(EVENTS.CLEAR);
    if (storyId) {
      setData(createEmptyData(storyId));
    }
  }, [emit, storyId]);

  return {
    data: data || (storyId ? createEmptyData(storyId) : null),
    clearData,
    isLoading: !data && !!storyId,
  };
}
