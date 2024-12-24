import * as React from 'react';

import { IconButton, TooltipNote, WithTooltip } from 'storybook/internal/components';
import { styled, typography } from 'storybook/internal/theming';

import { ListUnorderedIcon } from '@storybook/icons';
import { type Call, CallStates, type ControlStates } from '@storybook/instrumenter';

import { transparentize } from 'polished';

import { isChaiError, isJestError, useAnsiToHtmlFilter } from '../utils';
import type { Controls } from './InteractionsPanel';
import { MatcherResult } from './MatcherResult';
import { MethodCall } from './MethodCall';
import { StatusIcon } from './StatusIcon';

const MethodCallWrapper = styled.div(() => ({
  fontFamily: typography.fonts.mono,
  fontSize: typography.size.s1,
  overflowWrap: 'break-word',
  inlineSize: 'calc( 100% - 40px )',
}));

const RowContainer = styled('div', {
  shouldForwardProp: (prop) => !['call', 'pausedAt'].includes(prop.toString()),
})<{ call: Call; pausedAt: Call['id'] }>(
  ({ theme, call }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    borderBottom: `1px solid ${theme.appBorderColor}`,
    fontFamily: typography.fonts.base,
    fontSize: 13,
    ...(call.status === CallStates.ERROR && {
      backgroundColor:
        theme.base === 'dark'
          ? transparentize(0.93, theme.color.negative)
          : theme.background.warning,
    }),
    paddingLeft: (call.ancestors?.length ?? 0) * 20,
  }),
  ({ theme, call, pausedAt }) =>
    pausedAt === call.id && {
      '&::before': {
        content: '""',
        position: 'absolute',
        top: -5,
        zIndex: 1,
        borderTop: '4.5px solid transparent',
        borderLeft: `7px solid ${theme.color.warning}`,
        borderBottom: '4.5px solid transparent',
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: -1,
        zIndex: 1,
        width: '100%',
        borderTop: `1.5px solid ${theme.color.warning}`,
      },
    }
);

const RowHeader = styled.div<{ isInteractive: boolean }>(({ theme, isInteractive }) => ({
  display: 'flex',
  '&:hover': isInteractive ? {} : { background: theme.background.hoverable },
}));

const RowLabel = styled('button', {
  shouldForwardProp: (prop) => !['call'].includes(prop.toString()),
})<React.ButtonHTMLAttributes<HTMLButtonElement> & { call: Call }>(({ theme, disabled, call }) => ({
  flex: 1,
  display: 'grid',
  background: 'none',
  border: 0,
  gridTemplateColumns: '15px 1fr',
  alignItems: 'center',
  minHeight: 40,
  margin: 0,
  padding: '8px 15px',
  textAlign: 'start',
  cursor: disabled || call.status === CallStates.ERROR ? 'default' : 'pointer',
  '&:focus-visible': {
    outline: 0,
    boxShadow: `inset 3px 0 0 0 ${
      call.status === CallStates.ERROR ? theme.color.warning : theme.color.secondary
    }`,
    background: call.status === CallStates.ERROR ? 'transparent' : theme.background.hoverable,
  },
  '& > div': {
    opacity: call.status === CallStates.WAITING ? 0.5 : 1,
  },
}));

const RowActions = styled.div({
  padding: 6,
});

export const StyledIconButton = styled(IconButton as any)(({ theme }) => ({
  color: theme.textMutedColor,
  margin: '0 3px',
}));

const Note = styled(TooltipNote)(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
}));

const RowMessage = styled('div')(({ theme }) => ({
  padding: '8px 10px 8px 36px',
  fontSize: typography.size.s1,
  color: theme.color.defaultText,
  pre: {
    margin: 0,
    padding: 0,
  },
}));

export const Exception = ({ exception }: { exception: Call['exception'] }) => {
  const filter = useAnsiToHtmlFilter();
  if (isJestError(exception)) {
    return <MatcherResult {...exception} />;
  }
  if (isChaiError(exception)) {
    return (
      <RowMessage>
        <MatcherResult
          message={`${exception.message}${exception.diff ? `\n\n${exception.diff}` : ''}`}
          style={{ padding: 0 }}
        />
        <p>See the full stack trace in the browser console.</p>
      </RowMessage>
    );
  }

  const paragraphs = exception.message.split('\n\n');
  const more = paragraphs.length > 1;
  return (
    <RowMessage>
      <pre dangerouslySetInnerHTML={{ __html: filter.toHtml(paragraphs[0]) }}></pre>
      {more && <p>See the full stack trace in the browser console.</p>}
    </RowMessage>
  );
};

export const Interaction = ({
  call,
  callsById,
  controls,
  controlStates,
  childCallIds,
  isHidden,
  isCollapsed,
  toggleCollapsed,
  pausedAt,
}: {
  call: Call;
  callsById: Map<Call['id'], Call>;
  controls: Controls;
  controlStates: ControlStates;
  childCallIds?: Call['id'][];
  isHidden: boolean;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  pausedAt?: Call['id'];
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const isInteractive = !controlStates.goto || !call.interceptable || !!call.ancestors?.length;

  if (isHidden) {
    return null;
  }

  return (
    <RowContainer call={call} pausedAt={pausedAt}>
      <RowHeader isInteractive={isInteractive}>
        <RowLabel
          aria-label="Interaction step"
          call={call}
          onClick={() => controls.goto(call.id)}
          disabled={isInteractive}
          onMouseEnter={() => controlStates.goto && setIsHovered(true)}
          onMouseLeave={() => controlStates.goto && setIsHovered(false)}
        >
          <StatusIcon status={isHovered ? CallStates.ACTIVE : call.status} />
          <MethodCallWrapper style={{ marginLeft: 6, marginBottom: 1 }}>
            <MethodCall call={call} callsById={callsById} />
          </MethodCallWrapper>
        </RowLabel>
        <RowActions>
          {childCallIds?.length > 0 && (
            <WithTooltip
              hasChrome={false}
              tooltip={<Note note={`${isCollapsed ? 'Show' : 'Hide'} interactions`} />}
            >
              <StyledIconButton onClick={toggleCollapsed}>
                <ListUnorderedIcon />
              </StyledIconButton>
            </WithTooltip>
          )}
        </RowActions>
      </RowHeader>

      {call.status === CallStates.ERROR && call.exception?.callId === call.id && (
        <Exception exception={call.exception} />
      )}
    </RowContainer>
  );
};
