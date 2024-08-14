import type { CoverageItem } from '../types';

export function lineCoverage(item: CoverageItem) {
  const lineToMissing: Record<number, boolean> = {};

  Object.entries(item.s).forEach(([statementId, isCovered]) => {
    const stmt = item.statementMap[statementId];
    if (!isCovered) {
      for (let i: number = stmt.start.line; i <= stmt.end.line; i += 1) {
        lineToMissing[i] = true;
      }
    }
  });

  return lineToMissing;
}
