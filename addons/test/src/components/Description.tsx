import React, { type ComponentProps, useEffect } from 'react';

import { Link as LinkComponent } from 'storybook/internal/components';
import { type TestProviderConfig, type TestProviderState } from 'storybook/internal/core-events';
import { styled } from 'storybook/internal/theming';

import type { TestResultResult } from '../node/reporter';
import { GlobalErrorContext } from './GlobalErrorModal';
import { RelativeTime } from './RelativeTime';

export const Wrapper = styled.div(({ theme }) => ({
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  fontSize: theme.typography.size.s1,
  color: theme.textMutedColor,
}));

const PositiveText = styled.span(({ theme }) => ({
  color: theme.color.positiveText,
}));

interface DescriptionProps extends Omit<ComponentProps<typeof Wrapper>, 'results'> {
  state: TestProviderConfig & TestProviderState;
  entryId?: string;
  results?: TestResultResult[];
}

export function Description({ state, entryId, results, ...props }: DescriptionProps) {
  const isMounted = React.useRef(false);
  const [isUpdated, setUpdated] = React.useState(false);
  const { setModalOpen } = React.useContext(GlobalErrorContext);

  useEffect(() => {
    if (isMounted.current) {
      setUpdated(true);
      const timeout = setTimeout(setUpdated, 2000, false);
      return () => {
        clearTimeout(timeout);
      };
    }
    isMounted.current = true;
  }, [state.config]);

  const errorMessage = state.error?.message;

  let description: string | React.ReactNode = 'Not run';
  if (isUpdated) {
    description = <PositiveText>Settings updated</PositiveText>;
  } else if (state.running) {
    description = state.progress
      ? `Testing... ${state.progress.numPassedTests}/${state.progress.numTotalTests}`
      : 'Starting...';
  } else if (entryId && results?.length) {
    description = `Ran ${results.length} ${results.length === 1 ? 'test' : 'tests'}`;
  } else if (state.failed && !errorMessage) {
    description = 'Failed';
  } else if (state.crashed || (state.failed && errorMessage)) {
    description = setModalOpen ? (
      <LinkComponent isButton onClick={() => setModalOpen(true)}>
        {state.error?.name || 'View full error'}
      </LinkComponent>
    ) : (
      state.error?.name || 'Failed'
    );
  } else if (state.progress?.finishedAt) {
    description = (
      <>
        Ran {state.progress.numTotalTests} {state.progress.numTotalTests === 1 ? 'test' : 'tests'}{' '}
        <RelativeTime timestamp={state.progress.finishedAt} />
      </>
    );
  } else if (state.watching) {
    description = 'Watching for file changes';
  }

  return <Wrapper {...props}>{description}</Wrapper>;
}
