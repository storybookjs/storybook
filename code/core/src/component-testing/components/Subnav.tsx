import type { ComponentProps } from 'react';
import React from 'react';

import { Bar, Button, IconButton, P, Separator } from 'storybook/internal/components';

import {
  FastForwardIcon,
  PlayBackIcon,
  PlayNextIcon,
  RewindIcon,
  SyncIcon,
} from '@storybook/icons';

import { styled, useTheme } from 'storybook/theming';

import { type ControlStates } from '../../instrumenter/types';
import type { Controls } from './InteractionsPanel';
import { type PlayStatus, StatusBadge } from './StatusBadge';

const SubnavWrapper = styled.div(({ theme }) => ({
  boxShadow: `${theme.appBorderColor} 0 -1px 0 0 inset`,
  background: theme.background.app,
  position: 'sticky',
  top: 0,
  zIndex: 1,
}));

const StyledSubnav = styled.nav({
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 15,
});

interface SubnavProps {
  controls: Controls;
  controlStates: ControlStates;
  status: PlayStatus;
  storyFileName?: string;
  onScrollToEnd?: () => void;
}

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 4,
  padding: 6,
  color: theme.textMutedColor,
  '&:not(:disabled)': {
    '&:hover,&:focus-visible': {
      color: theme.color.secondary,
    },
  },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: theme.textMutedColor,
  margin: '0 3px',
}));

const StyledSeparator = styled(Separator)({
  marginTop: 0,
});

const StyledLocation = styled(P)(({ theme }) => ({
  color: theme.textMutedColor,
  justifyContent: 'flex-end',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  marginTop: 'auto',
  marginBottom: 1,
  paddingRight: 15,
  fontSize: 13,
}));

const Group = styled.div({
  display: 'flex',
  alignItems: 'center',
});

const RewindButton = styled(StyledIconButton)({
  marginLeft: 9,
});

const JumpToEndButton = styled(StyledButton)({
  marginLeft: 9,
  marginRight: 9,
  marginBottom: 1,
  lineHeight: '12px',
});

interface AnimatedButtonProps {
  animating?: boolean;
}

const RerunButton = styled(StyledIconButton)<
  AnimatedButtonProps & ComponentProps<typeof StyledIconButton>
>(({ theme, animating, disabled }) => ({
  opacity: disabled ? 0.5 : 1,
  svg: {
    animation: animating ? `${theme.animation.rotate360} 200ms ease-out` : undefined,
  },
}));

export const Subnav: React.FC<SubnavProps> = ({
  controls,
  controlStates,
  status,
  storyFileName,
  onScrollToEnd,
}) => {
  const buttonText = status === 'errored' ? 'Scroll to error' : 'Scroll to end';
  const theme = useTheme();

  return (
    <SubnavWrapper>
      <Bar backgroundColor={theme.background.app}>
        <StyledSubnav aria-label="Component tests toolbar">
          <Group>
            <StatusBadge status={status} />

            <JumpToEndButton onClick={onScrollToEnd} disabled={!onScrollToEnd}>
              {buttonText}
            </JumpToEndButton>

            <StyledSeparator />

            <RewindButton
              ariaLabel="Go to start"
              onClick={controls.start}
              disabled={!controlStates.start}
            >
              <RewindIcon />
            </RewindButton>

            <StyledIconButton
              ariaLabel="Go back"
              onClick={controls.back}
              disabled={!controlStates.back}
            >
              <PlayBackIcon />
            </StyledIconButton>

            <StyledIconButton
              ariaLabel="Go forward"
              onClick={controls.next}
              disabled={!controlStates.next}
            >
              <PlayNextIcon />
            </StyledIconButton>

            <StyledIconButton
              ariaLabel="Go to end"
              onClick={controls.end}
              disabled={!controlStates.end}
            >
              <FastForwardIcon />
            </StyledIconButton>

            <RerunButton ariaLabel="Rerun" onClick={controls.rerun}>
              <SyncIcon />
            </RerunButton>
          </Group>
          {storyFileName && (
            <Group>
              <StyledLocation>{storyFileName}</StyledLocation>
            </Group>
          )}
        </StyledSubnav>
      </Bar>
    </SubnavWrapper>
  );
};
