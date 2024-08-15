import React, { useCallback } from 'react';

import { Badge } from 'storybook/internal/components';

import { useCoverage } from './coverage-panel.hooks';

export function CoverageTitle() {
  const { coverage } = useCoverage();

  const getStatus = useCallback((percentage: number) => {
    if (percentage > 80) {
      return 'positive';
    }
    if (percentage > 60) {
      return 'warning';
    }
    if (percentage > 20) {
      return 'negative';
    }

    return 'critical';
  }, []);

  if (!coverage) {
    return (
      <div>
        Coverage <Badge status="neutral">Loading</Badge>
      </div>
    );
  }

  if ('summary' in coverage) {
    const coverageSummary = coverage.summary;

    const totalSum =
      coverageSummary.statements.total +
      coverageSummary.branches.total +
      coverageSummary.functions.total;
    const coveredSum =
      coverageSummary.statements.covered +
      coverageSummary.branches.covered +
      coverageSummary.functions.covered;

    const percentage = Math.round((coveredSum / totalSum) * 100);

    return (
      <div>
        Coverage <Badge status={getStatus(percentage)}>{Math.round(percentage)} %</Badge>
      </div>
    );
  } else {
    return (
      <div>
        Coverage <Badge status="neutral">N/A</Badge>
      </div>
    );
  }
}
