import * as React from 'react';

import { Button } from 'storybook/internal/components';

import { ChevronDownIcon, ChevronUpIcon } from '@storybook/icons';

import { transparentize } from 'polished';
import { styled, typography } from 'storybook/theming';

import { type Call, CallStates, type ControlStates } from '../../instrumenter/types';
import { INTERNAL_RENDER_CALL_ID } from '../constants';
import { isChaiError, isJestError, useAnsiToHtmlFilter } from '../utils';
import type { Controls } from './InteractionsPanel';
import { MatcherResult } from './MatcherResult';
import { MethodCall } from './MethodCall';
import { StatusIcon } from './StatusIcon';

const MethodCallWrapper = styled.div({
  fontFamily: typography.fonts.mono,
  fontSize: typography.size.s1,
  overflowWrap: 'break-word',
  inlineSize: 'calc( 100% - 40px )',
});

const RowContainer = styled('div', {
  shouldForwardProp: (prop) => !['call', 'pausedAt'].includes(prop.toString()),
})<{ call: Call; pausedAt: Call['id'] | undefined }>(
  ({ theme, call }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    borderBottom: `1px solid var(--sb-appBorderColor)`,
    fontFamily: 'var(--sb-typography-fonts-base)',
    fontSize: `calc(var(--sb-typography-size-s2) - 1px)`,
    ...(call.status === CallStates.ERROR && {
      backgroundColor:
        theme.base === 'dark'
          ? transparentize(0.93, theme.color.negative)
          : 'var(--sb-background-warning)',
    }),
    paddingLeft: (call.ancestors?.length ?? 0) * 20,
  }),
  ({ call, pausedAt }) =>
    pausedAt === call.id && {
      '&::before': {
        content: '""',
        position: 'absolute',
        top: -5,
        zIndex: 1,
        borderTop: '4.5px solid transparent',
        borderLeft: `7px solid var(--sb-color-warning)`,
        borderBottom: '4.5px solid transparent',
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: -1,
        zIndex: 1,
        width: '100%',
        borderTop: `1.5px solid var(--sb-color-warning)`,
      },
    }
);

const RowHeader = styled.div<{ isInteractive: boolean }>(({ isInteractive }) => ({
  display: 'flex',
  '&:hover': isInteractive ? {} : { background: 'var(--sb-background-hoverable)' },
}));

const RowLabel = styled('button', {
  shouldForwardProp: (prop) => !['call'].includes(prop.toString()),
})<React.ButtonHTMLAttributes<HTMLButtonElement> & { call: Call }>(({ disabled, call }) => ({
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
      call.status === CallStates.ERROR ? 'var(--sb-color-warning)' : 'var(--sb-color-secondary)'
    }`,
    background: call.status === CallStates.ERROR ? 'transparent' : 'var(--sb-background-hoverable)',
  },
  '& > div': {
    opacity: call.status === CallStates.WAITING ? 0.5 : 1,
  },
}));

const RowActions = styled.div({
  display: 'flex',
  alignItems: 'center',
  padding: 6,
});

const StyledButton = styled(Button)({
  color: 'var(--sb-textMutedColor)',
  margin: '0 3px',
});

const RowMessage = styled('div')({
  padding: '8px 10px 8px 36px',
  fontSize: `var(--sb-typography-size-s1)`,
  color: 'var(--sb-color-defaultText)',
  pre: {
    margin: 0,
    padding: 0,
  },
});

const ErrorName = styled.span(({ theme }) => ({
  color: theme.base === 'dark' ? '#5EC1FF' : '#0271B6',
}));

const ErrorMessage = styled.span(({ theme }) => ({
  color: theme.base === 'dark' ? '#eee' : '#444',
}));

const ErrorExplainer = styled.p(({ theme }) => ({
  color: theme.base === 'dark' ? 'var(--sb-color-negative)' : 'var(--sb-color-negativeText)',
  fontSize: `var(--sb-typography-size-s2)`,
  maxWidth: 500,
  textWrap: 'balance',
}));

const Exception = ({ exception }: { exception: Call['exception'] }) => {
  const filter = useAnsiToHtmlFilter();
  if (!exception) {
    return null;
  }
  if (exception.callId === INTERNAL_RENDER_CALL_ID) {
    return (
      <RowMessage>
        <pre>
          <ErrorName>{exception.name}:</ErrorName> <ErrorMessage>{exception.message}</ErrorMessage>
        </pre>
        <ErrorExplainer>
          The component failed to render properly. Automated component tests will not run until this
          is resolved. Check the full error message in Storybook’s canvas to debug.
        </ErrorExplainer>
      </RowMessage>
    );
  }
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

  if (call.id === INTERNAL_RENDER_CALL_ID) {
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
          {(childCallIds?.length ?? 0) > 0 && (
            <StyledButton
              padding="small"
              variant="ghost"
              onClick={toggleCollapsed}
              ariaLabel={`${isCollapsed ? 'Show' : 'Hide'} steps`}
            >
              {/* FIXME: accordion pattern */}
              {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
            </StyledButton>
          )}
        </RowActions>
      </RowHeader>

      {call.status === CallStates.ERROR && call.exception?.callId === call.id && (
        <Exception exception={call.exception} />
      )}
    </RowContainer>
  );
};
