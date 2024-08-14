import { useRef, useState } from 'react';

import { STORY_RENDERED } from 'storybook/internal/core-events';
import { useChannel } from 'storybook/internal/manager-api';

import {
  RESULT_COVERAGE_EVENT,
  RESULT_FILE_CONTENT,
  type ResultCoverageEventPayload,
  type ResultFileContentPayload,
} from '../constants';

export function useCoverage() {
  const [coverage, setCoverage] = useState<ResultCoverageEventPayload | null>(null);
  const storyKindRef = useRef<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useChannel({
    [RESULT_COVERAGE_EVENT]: (data: ResultCoverageEventPayload) => {
      setCoverage(data);
    },
    [RESULT_FILE_CONTENT]: ({ content }: ResultFileContentPayload) => {
      setFileContent(content);
      setCoverage(null);
    },
    [STORY_RENDERED]: (id) => {
      const kind = id.split('--')[0];
      // Reset only coverage and content when switching story files
      if (kind !== storyKindRef.current) {
        setCoverage(null);
        setFileContent(null);
        storyKindRef.current = kind;
      }
    },
  });

  return {
    coverage,
    fileContent,
  };
}
