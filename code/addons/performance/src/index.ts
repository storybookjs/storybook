/**
 * @storybook/addon-performance
 * Component performance profiler for Storybook
 */

import { definePreviewAddon } from 'storybook/internal/csf';
import * as addonAnnotations from './preview';
import type { PerformanceTypes } from './types';

// Types
export type {
  ProfilerData,
  PerformanceMetrics,
  StoryPerformanceData,
  BudgetStatus,
  PerformanceBudget,
  PerformanceParameters,
  PerformanceReport,
  AddonOptions,
  PerformanceTypes,
} from './types';

// Constants
export { ADDON_ID, PANEL_ID, PARAM_KEY, EVENTS, DEFAULT_BUDGET } from './constants';
export type { Budget } from './constants';

// Utilities
export { evaluateBudget, getStatusColor, getStatusEmoji, formatMs } from './utils/budget';
export type { BudgetResult } from './utils/budget';
export { generateReport, formatReportJson, formatReportMarkdown } from './utils/reporter';

// Components (for advanced usage)
export { Panel } from './Panel';
export { MetricCard } from './components/MetricCard';
export { RenderChart } from './components/RenderChart';
export { BudgetIndicator } from './components/BudgetIndicator';

// Hooks
export { usePerformanceData } from './hooks/usePerformanceData';

// Decorator
export { withPerformance } from './preview';

// Default export for definePreviewAddon pattern
export default () => definePreviewAddon<PerformanceTypes>(addonAnnotations);
