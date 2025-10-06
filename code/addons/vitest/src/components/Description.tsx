import React, { type ComponentProps } from 'react';

import { Link as LinkComponent } from 'storybook/internal/components';
import type { TestProviderState } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

import type { StoreState } from '../types';
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
  storeState: StoreState;
  testProviderState: TestProviderState;
  entryId?: string;
  isSettingsUpdated: boolean;
}

export function Description({
  entryId,
  storeState,
  testProviderState,
  isSettingsUpdated,
  ...props
}: DescriptionProps) {
  const { setModalOpen } = React.useContext(GlobalErrorContext);

  const { componentTestCount, totalTestCount, unhandledErrors, finishedAt } = storeState.currentRun;
  const finishedTestCount = componentTestCount.success + componentTestCount.error;

  let description: string | React.ReactNode = 'Not run';
  if (!entryId && isSettingsUpdated) {
    description = <PositiveText>Settings updated</PositiveText>;
  } else if (testProviderState === 'test-provider-state:running') {
    description =
      (finishedTestCount ?? 0) === 0
        ? 'Starting...'
        : `Testing... ${finishedTestCount}/${totalTestCount}`;
  } else if (!entryId && testProviderState === 'test-provider-state:crashed') {
    description = setModalOpen ? (
      <LinkComponent isButton onClick={() => setModalOpen(true)}>
        View full error
      </LinkComponent>
    ) : (
      'Crashed'
    );
  } else if (!entryId && unhandledErrors.length > 0) {
    const unhandledErrorDescription = `View ${unhandledErrors.length} unhandled error${unhandledErrors?.length > 1 ? 's' : ''}`;
    description = setModalOpen ? (
      <LinkComponent isButton onClick={() => setModalOpen(true)}>
        {unhandledErrorDescription}
      </LinkComponent>
    ) : (
      unhandledErrorDescription
    );
  } else if (entryId && totalTestCount) {
    description = `Ran ${totalTestCount} ${totalTestCount === 1 ? 'test' : 'tests'}`;
  } else if (finishedAt) {
    description = (
      <>
        Ran {totalTestCount} {totalTestCount === 1 ? 'test' : 'tests'}{' '}
        <RelativeTime timestamp={finishedAt} />
      </>
    );
  } else if (storeState.watching) {
    description = 'Watching for file changes';
  }

  return <Wrapper {...props}>{description}</Wrapper>;
}
