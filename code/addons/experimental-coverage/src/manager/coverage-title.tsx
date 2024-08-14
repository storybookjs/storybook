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

  if (coverage?.coverageSummary) {
    const percentage = coverage.coverageSummary?.statements.pct;

    return (
      <div>
        Coverage <Badge status={getStatus(percentage)}>{Math.round(percentage)} %</Badge>
      </div>
    );
  }
}
