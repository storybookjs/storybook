import React, { useState } from 'react';

import { SyntaxHighlighter } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';
import { type API, useChannel } from 'storybook/internal/manager-api';

import { RESULT_EVENT, type RequestEventPayload, type ResultEventPayload } from './constants';

type CoveragePanelProps = {
  active: boolean;
  api: API;
};

type State = ResultEventPayload | Record<string, never>;

export function CoveragePanel({ active, api }: CoveragePanelProps) {
  const [state, setState] = useState<State>({});

  useChannel({
    [STORY_CHANGED]: () => {
      setState({});
    },
    [RESULT_EVENT]: (data: ResultEventPayload) => {
      setState(data);
    },
  });

  if (!active) {
    return null;
  }

  if (!state.content) {
    return <div>Loading...</div>;
  }

  return <SyntaxHighlighter language="tsx">{state.content}</SyntaxHighlighter>;
}
