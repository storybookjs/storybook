import type { ComponentProps } from 'react';
import React from 'react';

import { Button, P, Separator, Toolbar as SharedToolbar } from 'storybook/internal/components';

import {
  FastForwardIcon,
  PlayBackIcon,
  PlayNextIcon,
  RewindIcon,
  SyncIcon,
} from '@storybook/icons';

import { type API } from 'storybook/manager-api';
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
  importPath?: string;
  canOpenInEditor?: boolean;
  api: API;
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

const StyledIconButton = styled(Button)(({ theme }) => ({
  color: theme.textMutedColor,
}));

const OpenInEditorButton = styled(Button)(({ theme }) => ({
  color: theme.color.secondary,
  fontWeight: theme.typography.weight.bold,
  justifyContent: 'flex-end',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontSize: 13,
  lineHeight: 24,
}));

const StyledLocation = styled(P)(({ theme }) => ({
  color: theme.textMutedColor,
  cursor: 'default',
  fontWeight: theme.typography.weight.regular,
  justifyContent: 'flex-end',
  textAlign: 'right',
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
  importPath,
  canOpenInEditor,
  api,
}) => {
  const buttonText = status === 'errored' ? 'Scroll to error' : 'Scroll to end';
  const theme = useTheme();

  return (
    <ToolbarWrapper>
      <SharedToolbar
        backgroundColor={theme.background.app}
        innerStyle={{ gap: 6, paddingInline: 15 }}
        aria-label="Component test playback controls"
      >
        <ControlsGroup>
          <StatusBadge status={status} />

          <JumpToEndButton ariaLabel={false} onClick={onScrollToEnd} disabled={!onScrollToEnd}>
            {buttonText}
          </JumpToEndButton>

          <Separator />

          <RewindButton
            padding="small"
            variant="ghost"
            ariaLabel="Go to start"
            onClick={controls.start}
            disabled={!controlStates.start}
          >
            <RewindIcon />
          </RewindButton>

          <StyledIconButton
            padding="small"
            variant="ghost"
            ariaLabel="Go back"
            onClick={controls.back}
            disabled={!controlStates.back}
          >
            <PlayBackIcon />
          </StyledIconButton>

          <StyledIconButton
            padding="small"
            variant="ghost"
            ariaLabel="Go forward"
            onClick={controls.next}
            disabled={!controlStates.next}
          >
            <PlayNextIcon />
          </StyledIconButton>

          <StyledIconButton
            padding="small"
            variant="ghost"
            ariaLabel="Go to end"
            onClick={controls.end}
            disabled={!controlStates.end}
          >
            <FastForwardIcon />
          </StyledIconButton>

          <RerunButton padding="small" variant="ghost" ariaLabel="Rerun" onClick={controls.rerun}>
            <SyncIcon />
          </RerunButton>
        </ControlsGroup>
        {(importPath || storyFileName) &&
          (canOpenInEditor ? (
            <OpenInEditorButton
              padding="small"
              size="small"
              variant="ghost"
              ariaLabel="Open in editor"
              onClick={() => {
                api.openInEditor({
                  file: importPath as string,
                });
              }}
            >
              {storyFileName}
            </OpenInEditorButton>
          ) : (
            <StyledLocation>{storyFileName}</StyledLocation>
          ))}
      </SharedToolbar>
    </ToolbarWrapper>
  );
};
