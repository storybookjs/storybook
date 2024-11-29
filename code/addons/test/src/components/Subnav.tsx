import type { ComponentProps } from 'react';
import React from 'react';

import {
  Bar,
  Button,
  IconButton,
  P,
  Separator,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import {
  FastForwardIcon,
  PlayBackIcon,
  PlayNextIcon,
  RewindIcon,
  SyncIcon,
} from '@storybook/icons';
import type { Call, ControlStates } from '@storybook/instrumenter';
import { CallStates } from '@storybook/instrumenter';

import type { Controls } from './InteractionsPanel';
import { StatusBadge } from './StatusBadge';

const SubnavWrapper = styled.div(({ theme }) => ({
  background: theme.background.app,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  position: 'sticky',
  top: 0,
  zIndex: 1,
}));

const StyledSubnav = styled.nav(({ theme }) => ({
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 15,
}));

interface SubnavProps {
  controls: Controls;
  controlStates: ControlStates;
  status: Call['status'];
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

const Note = styled(TooltipNote)(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
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
    animation: animating && `${theme.animation.rotate360} 200ms ease-out`,
  },
}));

export const Subnav: React.FC<SubnavProps> = ({
  controls,
  controlStates,
  status,
  storyFileName,
  onScrollToEnd,
}) => {
  const buttonText = status === CallStates.ERROR ? 'Scroll to error' : 'Scroll to end';

  return (
    <SubnavWrapper>
      <Bar>
        <StyledSubnav>
          <Group>
            <StatusBadge status={status} />

            <JumpToEndButton onClick={onScrollToEnd} disabled={!onScrollToEnd}>
              {buttonText}
            </JumpToEndButton>

            <StyledSeparator />

            <WithTooltip trigger="hover" hasChrome={false} tooltip={<Note note="Go to start" />}>
              <RewindButton
                aria-label="Go to start"
                onClick={controls.start}
                disabled={!controlStates.start}
              >
                <RewindIcon />
              </RewindButton>
            </WithTooltip>

            <WithTooltip trigger="hover" hasChrome={false} tooltip={<Note note="Go back" />}>
              <StyledIconButton
                aria-label="Go back"
                onClick={controls.back}
                disabled={!controlStates.back}
              >
                <PlayBackIcon />
              </StyledIconButton>
            </WithTooltip>

            <WithTooltip trigger="hover" hasChrome={false} tooltip={<Note note="Go forward" />}>
              <StyledIconButton
                aria-label="Go forward"
                onClick={controls.next}
                disabled={!controlStates.next}
              >
                <PlayNextIcon />
              </StyledIconButton>
            </WithTooltip>

            <WithTooltip trigger="hover" hasChrome={false} tooltip={<Note note="Go to end" />}>
              <StyledIconButton
                aria-label="Go to end"
                onClick={controls.end}
                disabled={!controlStates.end}
              >
                <FastForwardIcon />
              </StyledIconButton>
            </WithTooltip>

            <WithTooltip trigger="hover" hasChrome={false} tooltip={<Note note="Rerun" />}>
              <RerunButton aria-label="Rerun" onClick={controls.rerun}>
                <SyncIcon />
              </RerunButton>
            </WithTooltip>
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
