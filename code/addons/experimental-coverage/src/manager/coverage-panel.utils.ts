import type { CoverageItem } from '../types';

type CoverageType = 'statement' | 'partial-branch' | 'branch' | 'function' | undefined;

export function getLineCoverage(item: CoverageItem) {
  const missingCoverage: Record<number, CoverageType> = {};

  Object.entries(item.s).forEach(([statementId, isCovered]) => {
    const stmt = item.statementMap[statementId];
    if (!isCovered) {
      for (let i: number = stmt.start.line; i <= stmt.end.line; i += 1) {
        missingCoverage[i] = 'statement';
      }
    }
  });

  Object.entries(item.b).forEach(([statementId, isCoveredArray]) => {
    const branch = item.branchMap[statementId];
    const isEveryBranchUncovered = isCoveredArray.every((cov) => cov === 0);

    if (isEveryBranchUncovered) {
      for (let i: number = branch.loc.start.line; i <= branch.loc.end.line; i += 1) {
        missingCoverage[i] = 'branch';
      }
    }

    isCoveredArray.forEach((cov, index) => {
      if (cov === 1) {
        for (
          let i: number = branch.locations[index].start.line;
          i <= branch.locations[index].end.line;
          i += 1
        ) {
          missingCoverage[i] = 'partial-branch';
        }
      }
    });
  });

  return missingCoverage;
}
