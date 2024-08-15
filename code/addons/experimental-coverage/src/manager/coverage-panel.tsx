import React, { useCallback } from 'react';

import { SyntaxHighlighter } from 'storybook/internal/components';
import { type API } from 'storybook/internal/manager-api';

import type { CoverageItem } from '../types';
import { CoveragePanelDev } from './coverage-panel-dev';
import { useCoverage } from './coverage-panel.hooks';
import { getLineCoverage } from './coverage-panel.utils';

type CoveragePanelProps = {
  active: boolean;
  api: API;
};

export function CoveragePanel({ active }: CoveragePanelProps) {
  const { coverage, fileContent } = useCoverage();

  const getLineProps = useCallback((covItem: CoverageItem) => {
    const lineCoverage = getLineCoverage(covItem);
    return (lineNumber: number) => {
      return lineCoverage[lineNumber] === 'statement' || lineCoverage[lineNumber] === 'branch'
        ? { style: { backgroundColor: '#ffcccc', borderLeft: '5px solid #f85151' } }
        : lineCoverage[lineNumber] === 'partial-branch'
          ? { style: { backgroundColor: '#FFAA', borderLeft: '5px solid #FFEA10' } }
          : { style: { borderLeft: '5px solid #95de95' } };
    };
  }, []);

  if (!active) {
    return null;
  }

  if (!fileContent) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <CoveragePanelDev coverage={coverage} />
      <SyntaxHighlighter
        showLineNumbers
        wrapLongLines
        format={false}
        copyable={false}
        lineProps={
          coverage && 'stats' in coverage
            ? getLineProps(coverage.stats)
            : (line) => ({ style: { borderLeft: '5px solid gray' } })
        }
        padded
        language="tsx"
      >
        {fileContent}
      </SyntaxHighlighter>
    </div>
  );
}
