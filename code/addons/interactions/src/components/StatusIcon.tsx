import React from 'react';

import { styled, transparentize, useTheme } from 'storybook/internal/theming';

import { CheckIcon, CircleIcon, PlayIcon, StopAltIcon } from '@storybook/icons';
import { type Call, CallStates } from '@storybook/instrumenter';

export interface StatusIconProps {
  status: Call['status'];
}

const WarningContainer = styled.div({
  width: 14,
  height: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  const theme = useTheme();

  switch (status) {
    case CallStates.DONE: {
      return <CheckIcon color={theme.color.positive} data-testid="icon-done" />;
    }
    case CallStates.ERROR: {
      return <StopAltIcon color={theme.color.negative} data-testid="icon-error" />;
    }
    case CallStates.ACTIVE: {
      return <PlayIcon color={theme.color.secondary} data-testid="icon-active" />;
    }
    case CallStates.WAITING: {
      return (
        <WarningContainer data-testid="icon-waiting">
          <CircleIcon color={transparentize(0.5, '#CCCCCC')} size={6} />
        </WarningContainer>
      );
    }
    default: {
      return null;
    }
  }
};
