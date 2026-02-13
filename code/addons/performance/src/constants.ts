/**
 * Addon constants and event names
 */

export const ADDON_ID = 'storybook/performance';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = 'performance';

/** Channel events from preview to manager */
export const EVENTS = {
  /** Emitted when a render completes with profiler data */
  RENDER: `${ADDON_ID}/render`,
  /** Emitted when Performance Observer detects metrics */
  METRICS: `${ADDON_ID}/metrics`,
  /** Emitted when a re-render is detected */
  RERENDER: `${ADDON_ID}/rerender`,
  /** Command to clear all collected data */
  CLEAR: `${ADDON_ID}/clear`,
  /** Request current state from preview */
  REQUEST_STATE: `${ADDON_ID}/request-state`,
  /** Response with current state */
  STATE: `${ADDON_ID}/state`,
} as const;

/** Default performance budgets */
export const DEFAULT_BUDGET = {
  /** Max render time in ms for "good" status */
  renderTime: 16,
  /** Max render time in ms before "bad" status */
  renderTimeWarn: 50,
  /** Max re-renders before warning */
  rerenderLimit: 2,
  /** Max re-renders before bad */
  rerenderLimitWarn: 5,
  /** CLS threshold for good */
  cls: 0.1,
  /** CLS threshold for bad */
  clsWarn: 0.25,
  /** Long task count for good */
  longTasks: 0,
  /** Long task count for bad */
  longTasksWarn: 2,
} as const;

export type Budget = typeof DEFAULT_BUDGET;
