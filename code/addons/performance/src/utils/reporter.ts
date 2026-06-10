/**
 * CI Reporter - generates JSON performance reports
 */

import type { PerformanceReport, StoryPerformanceData, PerformanceBudget } from '../types';
import { evaluateBudget } from './budget';

export interface StoryMeta {
  storyId: string;
  title: string;
  name: string;
}

/**
 * Generate a performance report from collected data
 */
export function generateReport(
  stories: Map<string, StoryPerformanceData>,
  storyMeta: Map<string, StoryMeta>,
  budget?: Partial<PerformanceBudget>
): PerformanceReport {
  const storyResults: PerformanceReport['stories'] = {};
  let totalRenderTime = 0;
  let maxRenderTime = 0;
  let storiesOverBudget = 0;
  let storyCount = 0;

  for (const [storyId, data] of stories.entries()) {
    const meta = storyMeta.get(storyId) || {
      storyId,
      title: 'Unknown',
      name: storyId,
    };

    const budgetStatus = evaluateBudget(data, budget);

    storyResults[storyId] = {
      title: meta.title,
      name: meta.name,
      performance: {
        renderCount: data.renderCount,
        rerenderCount: data.rerenderCount,
        avgRenderTime: data.avgRenderTime,
        maxRenderTime: data.maxRenderTime,
        minRenderTime: data.minRenderTime,
        cls: data.metrics.cls,
        longTaskCount: data.metrics.longTaskCount,
        budgetStatus: {
          renderTime: budgetStatus.renderTime,
          rerenderCount: budgetStatus.rerenderCount,
          cls: budgetStatus.cls,
          longTasks: budgetStatus.longTasks,
        },
      },
    };

    totalRenderTime += data.avgRenderTime;
    if (data.maxRenderTime > maxRenderTime) {
      maxRenderTime = data.maxRenderTime;
    }
    if (budgetStatus.overall !== 'good') {
      storiesOverBudget++;
    }
    storyCount++;
  }

  return {
    timestamp: new Date().toISOString(),
    stories: storyResults,
    summary: {
      totalStories: storyCount,
      storiesOverBudget,
      avgRenderTime: storyCount > 0 ? totalRenderTime / storyCount : 0,
      maxRenderTime,
    },
  };
}

/**
 * Format report as JSON string
 */
export function formatReportJson(report: PerformanceReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Generate markdown summary for CI comments
 */
export function formatReportMarkdown(report: PerformanceReport): string {
  const lines: string[] = [
    '# Performance Report',
    '',
    `Generated: ${report.timestamp}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Stories | ${report.summary.totalStories} |`,
    `| Stories Over Budget | ${report.summary.storiesOverBudget} |`,
    `| Average Render Time | ${report.summary.avgRenderTime.toFixed(2)}ms |`,
    `| Max Render Time | ${report.summary.maxRenderTime.toFixed(2)}ms |`,
    '',
  ];

  if (Object.keys(report.stories).length > 0) {
    lines.push('## Stories');
    lines.push('');
    lines.push('| Story | Renders | Avg Time | Status |');
    lines.push('|-------|---------|----------|--------|');

    for (const [, story] of Object.entries(report.stories)) {
      const status =
        story.performance.budgetStatus.renderTime === 'good'
          ? '✅'
          : story.performance.budgetStatus.renderTime === 'warning'
            ? '⚠️'
            : '❌';

      lines.push(
        `| ${story.title}/${story.name} | ${story.performance.renderCount} | ${story.performance.avgRenderTime.toFixed(2)}ms | ${status} |`
      );
    }
  }

  return lines.join('\n');
}
