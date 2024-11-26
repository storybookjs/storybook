import React from 'react';

import { Link as LinkComponent } from 'storybook/internal/components';
import { type TestProviderConfig, type TestProviderState } from 'storybook/internal/core-events';
import { styled } from 'storybook/internal/theming';

import { RelativeTime } from './RelativeTime';

export const DescriptionStyle = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.barTextColor,
}));

export function Description({
  errorMessage,
  setIsModalOpen,
  state,
}: {
  state: TestProviderConfig & TestProviderState;
  errorMessage: string;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  let description: string | React.ReactNode = 'Not run';

  if (state.running) {
    description = state.progress
      ? `Testing... ${state.progress.numPassedTests}/${state.progress.numTotalTests}`
      : 'Starting...';
  } else if (state.failed && !errorMessage) {
    description = '';
  } else if (state.crashed || (state.failed && errorMessage)) {
    description = (
      <>
        <LinkComponent
          isButton
          onClick={() => {
            setIsModalOpen(true);
          }}
        >
          {state.error?.name || 'View full error'}
        </LinkComponent>
      </>
    );
  } else if (state.progress?.finishedAt) {
    description = (
      <RelativeTime
        timestamp={new Date(state.progress.finishedAt)}
        testCount={state.progress.numTotalTests}
      />
    );
  } else if (state.watching) {
    description = 'Watching for file changes';
  }
  return <DescriptionStyle id="testing-module-description">{description}</DescriptionStyle>;
}
