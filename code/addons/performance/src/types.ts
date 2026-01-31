/**
 * Type definitions for the performance addon
 */

import type { Budget } from './constants';

/** Data from React Profiler onRender callback */
export interface ProfilerData {
  /** Component/story ID */
  id: string;
  /** 'mount' or 'update' */
  phase: 'mount' | 'update' | 'nested-update';
  /** Time spent rendering the committed update */
  actualDuration: number;
  /** Estimated time to render the entire subtree without memoization */
  baseDuration: number;
  /** When React began rendering this update */
  startTime: number;
  /** When React committed this update */
  commitTime: number;
  /** Timestamp when this was recorded */
  timestamp: number;
}

/** Web vitals and Performance Observer data */
export interface PerformanceMetrics {
  /** Cumulative Layout Shift */
  cls: number;
  /** Number of long tasks detected (>50ms) */
  longTaskCount: number;
  /** Largest Contentful Paint in ms */
  lcp?: number;
  /** First Input Delay in ms */
  fid?: number;
  /** Time to First Byte in ms */
  ttfb?: number;
}

/** Aggregated performance data for a story */
export interface StoryPerformanceData {
  /** Story ID */
  storyId: string;
  /** Number of renders (including initial mount) */
  renderCount: number;
  /** Number of re-renders (excludes initial mount) */
  rerenderCount: number;
  /** All recorded profiler data */
  renders: ProfilerData[];
  /** Latest metrics from Performance Observer */
  metrics: PerformanceMetrics;
  /** Average render time across all renders */
  avgRenderTime: number;
  /** Minimum render time */
  minRenderTime: number;
  /** Maximum render time */
  maxRenderTime: number;
  /** Time of first render */
  firstRender?: number;
  /** Time of last render */
  lastRender?: number;
}

/** Budget status for a metric */
export type BudgetStatus = 'good' | 'warning' | 'bad';

/** Performance budget configuration */
export interface PerformanceBudget {
  /** Max render time in ms */
  renderTime?: number;
  /** Max re-renders allowed */
  rerenderLimit?: number;
  /** CLS threshold */
  cls?: number;
  /** Long task limit */
  longTasks?: number;
}

/** Story parameters for performance addon */
export interface PerformanceParameters {
  /** Disable performance tracking for this story */
  disable?: boolean;
  /** Performance budget overrides */
  budget?: Partial<PerformanceBudget>;
}

/** CI report format */
export interface PerformanceReport {
  /** Report generation timestamp */
  timestamp: string;
  /** Storybook version */
  storybookVersion?: string;
  /** Stories with performance data */
  stories: {
    [storyId: string]: {
      title: string;
      name: string;
      performance: {
        renderCount: number;
        rerenderCount: number;
        avgRenderTime: number;
        maxRenderTime: number;
        minRenderTime: number;
        cls: number;
        longTaskCount: number;
        budgetStatus: {
          renderTime: BudgetStatus;
          rerenderCount: BudgetStatus;
          cls: BudgetStatus;
          longTasks: BudgetStatus;
        };
      };
    };
  };
  /** Summary statistics */
  summary: {
    totalStories: number;
    storiesOverBudget: number;
    avgRenderTime: number;
    maxRenderTime: number;
  };
}

/** Addon options from main.ts */
export interface AddonOptions {
  /** Default budget for all stories */
  budget?: Partial<Budget>;
  /** Path to write CI report */
  reportPath?: string;
  /** Enable verbose logging */
  debug?: boolean;
}

/** Type augmentation for Storybook */
export interface PerformanceTypes {
  parameters: {
    performance?: PerformanceParameters;
  };
}
