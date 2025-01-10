import type { IndexInputStats } from '@storybook/core/types';

export type IndexStatsSummary = Record<keyof IndexInputStats, number>;

export const addStats = (stat: IndexInputStats, acc: IndexStatsSummary) => {
  Object.entries(stat).forEach(([key, value]) => {
    const statsKey = key as keyof IndexInputStats;

    if (!acc[statsKey]) {
      acc[statsKey] = 0;
    }
    acc[statsKey] += value ? 1 : 0;
  });
};

export const summarizeStats = (stats: IndexInputStats[]): IndexStatsSummary => {
  return stats.reduce((acc, stat) => {
    addStats(stat, acc);
    return acc;
  }, {} as IndexStatsSummary);
};
