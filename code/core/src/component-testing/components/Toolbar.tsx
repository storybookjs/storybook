import type { ComponentProps } from 'react';
import React from 'react';

import {
  AriaToolbar,
  Button,
  IconButton,
  P,
  Separator,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';

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

const ToolbarWrapper = styled.div(({ theme }) => ({
  boxShadow: `${theme.appBorderColor} 0 -1px 0 0 inset`,
  background: theme.background.app,
  position: 'sticky',
  top: 0,
  zIndex: 1,
}));

interface ToolbarProps {
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

const Note = styled(TooltipNote)(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: theme.textMutedColor,
}));

const StyledLocation = styled(P)(({ theme }) => ({
  color: theme.textMutedColor,
  whiteSpace: 'nowrap',
  margin: 0,
  fontSize: 13,
}));

const ControlsGroup = styled.div({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  gap: 6,
});

const RewindButton = styled(StyledIconButton)({
  marginInlineStart: 3,
});

const JumpToEndButton = styled(StyledButton)({
  marginInline: 3,
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

export const Toolbar: React.FC<ToolbarProps> = ({
  controls,
  controlStates,
  status,
  storyFileName,
  onScrollToEnd,
}) => {
  const buttonText = status === 'errored' ? 'Scroll to error' : 'Scroll to end';
  const theme = useTheme();

  return (
    <ToolbarWrapper>
      <AriaToolbar
        backgroundColor={theme.background.app}
        innerStyle={{ gap: 6, paddingInline: 15 }}
        aria-label="Component test playback controls"
      >
        <ControlsGroup>
          <StatusBadge status={status} />

          <JumpToEndButton onClick={onScrollToEnd} disabled={!onScrollToEnd}>
            {buttonText}
          </JumpToEndButton>

          <Separator />

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
        </ControlsGroup>
        {storyFileName && <StyledLocation>{storyFileName}</StyledLocation>}
      </AriaToolbar>
    </ToolbarWrapper>
  );
};
