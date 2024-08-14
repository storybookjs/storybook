import React, { useCallback } from 'react';

import { SyntaxHighlighter } from 'storybook/internal/components';
import { type API } from 'storybook/internal/manager-api';

import type { CoverageItem } from '../types';
import { useCoverage } from './coverage-panel.hooks';
import { lineCoverage } from './coverage-panel.utils';

type CoveragePanelProps = {
  active: boolean;
  api: API;
};

export function CoveragePanel({ active }: CoveragePanelProps) {
  const { coverage, fileContent } = useCoverage();

  const getLineProps = useCallback((covItem: CoverageItem) => {
    const lineToMissing = lineCoverage(covItem);
    return (lineNumber: number) =>
      lineToMissing[lineNumber]
        ? { style: { backgroundColor: '#ffcccc', borderLeft: '5px solid #f85151' } }
        : { style: { borderLeft: '5px solid #95de95' } };
  }, []);

  if (!active) {
    return null;
  }

  if (!fileContent) {
    return <div>Loading...</div>;
  }

  return (
    <SyntaxHighlighter
      showLineNumbers
      wrapLongLines
      format={false}
      copyable={false}
      lineProps={
        coverage
          ? getLineProps(coverage.coverage)
          : (line) => ({ style: { borderLeft: '5px solid gray' } })
      }
      padded
      language="tsx"
    >
      {fileContent}
    </SyntaxHighlighter>
  );
}
