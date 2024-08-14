import React, { useRef, useState } from 'react';

import { SyntaxHighlighter } from 'storybook/internal/components';
import { STORY_RENDERED } from 'storybook/internal/core-events';
import { type API, useChannel } from 'storybook/internal/manager-api';

import {
  RESULT_COVERAGE_EVENT,
  RESULT_FILE_CONTENT,
  type ResultCoverageEventPayload,
  type ResultFileContentPayload,
} from './constants';

type CoveragePanelProps = {
  active: boolean;
  api: API;
};

export function CoveragePanel({ active, api }: CoveragePanelProps) {
  const [coverage, setCoverage] = useState<ResultCoverageEventPayload | Record<string, never>>({});
  const [fileContent, setFileContent] = useState<string | null>(null);
  const storyKindRef = useRef<string | null>(null);

  useChannel({
    [STORY_RENDERED]: (id) => {
      const kind = id.split('--')[0];
      // Reset only coverage and content when switching story files
      if (kind !== storyKindRef.current) {
        setCoverage({});
        setFileContent(null);
        storyKindRef.current = kind;
      }
    },
    [RESULT_COVERAGE_EVENT]: (data: ResultCoverageEventPayload) => {
      setCoverage(data);
    },
    [RESULT_FILE_CONTENT]: ({ content }: ResultFileContentPayload) => {
      setFileContent(content);
    },
  });

  if (!active) {
    return null;
  }

  if (!fileContent) {
    return <div>Loading...</div>;
  }

  return <SyntaxHighlighter language="tsx">{fileContent}</SyntaxHighlighter>;
}
