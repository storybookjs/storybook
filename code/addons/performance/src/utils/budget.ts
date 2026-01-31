/**
 * Performance budget utilities
 */

import { DEFAULT_BUDGET } from '../constants';
import type { BudgetStatus, PerformanceBudget, StoryPerformanceData } from '../types';

/** Full budget with all thresholds */
interface FullBudget {
  renderTime: number;
  renderTimeWarn: number;
  rerenderLimit: number;
  rerenderLimitWarn: number;
  cls: number;
  clsWarn: number;
  longTasks: number;
  longTasksWarn: number;
}

export interface BudgetResult {
  renderTime: BudgetStatus;
  rerenderCount: BudgetStatus;
  cls: BudgetStatus;
  longTasks: BudgetStatus;
  overall: BudgetStatus;
}

/**
 * Evaluate performance data against budget thresholds
 */
export function evaluateBudget(
  data: StoryPerformanceData,
  budget: Partial<PerformanceBudget> = {}
): BudgetResult {
  const mergedBudget: FullBudget = { ...DEFAULT_BUDGET, ...budget };

  const renderTime = evaluateRenderTime(data.avgRenderTime, mergedBudget);
  const rerenderCount = evaluateRerenderCount(data.rerenderCount, mergedBudget);
  const cls = evaluateCLS(data.metrics.cls, mergedBudget);
  const longTasks = evaluateLongTasks(data.metrics.longTaskCount, mergedBudget);

  // Overall is the worst status
  const statuses = [renderTime, rerenderCount, cls, longTasks];
  let overall: BudgetStatus = 'good';
  if (statuses.includes('bad')) {
    overall = 'bad';
  } else if (statuses.includes('warning')) {
    overall = 'warning';
  }

  return { renderTime, rerenderCount, cls, longTasks, overall };
}

function evaluateRenderTime(time: number, budget: FullBudget): BudgetStatus {
  if (time <= budget.renderTime) return 'good';
  if (time <= budget.renderTimeWarn) return 'warning';
  return 'bad';
}

function evaluateRerenderCount(count: number, budget: FullBudget): BudgetStatus {
  if (count <= budget.rerenderLimit) return 'good';
  if (count <= budget.rerenderLimitWarn) return 'warning';
  return 'bad';
}

function evaluateCLS(cls: number, budget: FullBudget): BudgetStatus {
  if (cls <= budget.cls) return 'good';
  if (cls <= budget.clsWarn) return 'warning';
  return 'bad';
}

function evaluateLongTasks(count: number, budget: FullBudget): BudgetStatus {
  if (count <= budget.longTasks) return 'good';
  if (count <= budget.longTasksWarn) return 'warning';
  return 'bad';
}

/**
 * Get color for budget status
 */
export function getStatusColor(status: BudgetStatus): string {
  switch (status) {
    case 'good':
      return '#66bf3c';
    case 'warning':
      return '#e69d00';
    case 'bad':
      return '#ff4400';
  }
}

/**
 * Get emoji for budget status
 */
export function getStatusEmoji(status: BudgetStatus): string {
  switch (status) {
    case 'good':
      return '✓';
    case 'warning':
      return '⚠';
    case 'bad':
      return '✗';
  }
}

/**
 * Format milliseconds for display
 */
export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
