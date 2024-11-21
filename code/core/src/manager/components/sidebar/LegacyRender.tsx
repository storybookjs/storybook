import React from 'react';

import { Button } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import { EyeIcon, PlayHollowIcon, StopAltHollowIcon } from '@storybook/icons';

import type { TestProviders } from '@storybook/core/core-events';
import { useStorybookApi } from '@storybook/core/manager-api';

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 6,
});

const Actions = styled.div({
  display: 'flex',
  gap: 6,
});

const TitleWrapper = styled.div<{ crashed?: boolean }>(({ crashed, theme }) => ({
  fontSize: theme.typography.size.s1,
  fontWeight: crashed ? 'bold' : 'normal',
  color: crashed ? theme.color.negativeText : theme.color.defaultText,
}));

const DescriptionWrapper = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.barTextColor,
}));

export const LegacyRender = ({ ...state }: TestProviders[keyof TestProviders]) => {
  const Description = state.description!;
  const Title = state.title!;
  const api = useStorybookApi();

  return (
    <>
      <Info>
        <TitleWrapper crashed={state.crashed} id="testing-module-title">
          <Title {...state} />
        </TitleWrapper>
        <DescriptionWrapper id="testing-module-description">
          <Description {...state} />
        </DescriptionWrapper>
      </Info>

      <Actions>
        {state.watchable && (
          <Button
            aria-label={`${state.watching ? 'Disable' : 'Enable'} watch mode for ${name}`}
            variant="ghost"
            padding="small"
            active={state.watching}
            onClick={() => api.setTestProviderWatchMode(state.id, !state.watching)}
            disabled={state.crashed || state.running}
          >
            <EyeIcon />
          </Button>
        )}
        {state.runnable && (
          <>
            {state.running && state.cancellable ? (
              <Button
                aria-label={`Stop ${name}`}
                variant="ghost"
                padding="small"
                onClick={() => api.cancelTestProvider(state.id)}
                disabled={state.cancelling}
              >
                <StopAltHollowIcon />
              </Button>
            ) : (
              <Button
                aria-label={`Start ${state.name}`}
                variant="ghost"
                padding="small"
                onClick={() => api.runTestProvider(state.id)}
                disabled={state.crashed || state.running}
              >
                <PlayHollowIcon />
              </Button>
            )}
          </>
        )}
      </Actions>
    </>
  );
};
