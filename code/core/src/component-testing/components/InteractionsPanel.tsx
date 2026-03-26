import * as React from 'react';

import { transparentize } from 'polished';
import type { API } from 'storybook/manager-api';
import { srOnlyStyles, styled } from 'storybook/theming';

import { type Call, type CallStates, type ControlStates } from '../../instrumenter/types.ts';
import { INTERNAL_RENDER_CALL_ID } from '../constants.ts';
import { isTestAssertionError, useAnsiToHtmlFilter } from '../utils.ts';
import { DetachedDebuggerMessage } from './DetachedDebuggerMessage.tsx';
import { Empty } from './EmptyState.tsx';
import { Interaction } from './Interaction.tsx';
import type { PlayStatus } from './StatusBadge.tsx';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage.tsx';
import { Toolbar } from './Toolbar.tsx';

export interface Controls {
  start: (args?: any) => void;
  back: (args?: any) => void;
  goto: (args?: any) => void;
  next: (args?: any) => void;
  end: (args?: any) => void;
  rerun: (args?: any) => void;
}

interface InteractionsPanelProps {
  storyUrl: string;
  status: PlayStatus;
  controls: Controls;
  controlStates: ControlStates;
  interactions: (Call & {
    status?: CallStates;
    childCallIds?: Call['id'][];
    isHidden: boolean;
    isCollapsed: boolean;
    toggleCollapsed: () => void;
  })[];
  fileName?: string;
  hasException?: boolean;
  caughtException?: Error;
  unhandledErrors?: SerializedError[];
  pausedAt?: Call['id'];
  calls: Map<string, any>;
  endRef?: React.Ref<HTMLDivElement>;
  onScrollToEnd?: () => void;
  hasResultMismatch?: boolean;
  browserTestStatus?: CallStates;
  importPath?: string;
  canOpenInEditor?: boolean;
  api: API;
}

const Container = styled.div(({ theme }) => ({
  height: '100%',
  background: theme.background.content,
}));

const InteractionsSection = styled.section({
  position: 'relative',
});

const InteractionsHeading = styled.h3(srOnlyStyles);

const InteractionsList = styled.ol({
  margin: 0,
  padding: 0,
});

const LiveStatus = styled.div(srOnlyStyles);

const CaughtException = styled.div(({ theme }) => ({
  borderBottom: `1px solid ${theme.appBorderColor}`,
  backgroundColor:
    theme.base === 'dark' ? transparentize(0.93, theme.color.negative) : theme.background.warning,
  padding: 15,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px',
}));
const CaughtExceptionCode = styled.code(({ theme }) => ({
  margin: '0 1px',
  padding: 3,
  fontSize: theme.typography.size.s1 - 1,
  lineHeight: 1,
  verticalAlign: 'top',
  background: 'rgba(0, 0, 0, 0.05)',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 3,
}));
const CaughtExceptionTitle = styled.div({
  paddingBottom: 4,
  fontWeight: 'bold',
});
const CaughtExceptionDescription = styled.p({
  margin: 0,
  padding: '0 0 20px',
});

const CaughtExceptionStack = styled.pre(({ theme }) => ({
  margin: 0,
  padding: 0,
  '&:not(:last-child)': {
    paddingBottom: 16,
  },
  fontSize: theme.typography.size.s1 - 1,
}));

const StatusAnnouncementMapping: Record<PlayStatus, string> = {
  rendering: 'Component test is rendering.',
  playing: 'Component test is running.',
  completed: 'Component test completed successfully.',
  errored: 'Component test failed.',
  aborted: 'Component test was aborted.',
} as const;

const getStatusAnnouncement = (status: PlayStatus, hasException?: boolean) => {
  if (status === 'completed' && hasException) {
    return StatusAnnouncementMapping.errored;
  }
  return StatusAnnouncementMapping[status];
};

export const InteractionsPanel: React.FC<InteractionsPanelProps> = React.memo(
  function InteractionsPanel({
    storyUrl,
    status,
    calls,
    controls,
    controlStates,
    interactions,
    fileName,
    hasException,
    caughtException,
    unhandledErrors,
    pausedAt,
    onScrollToEnd,
    endRef,
    hasResultMismatch,
    browserTestStatus,
    importPath,
    canOpenInEditor,
    api,
  }) {
    const filter = useAnsiToHtmlFilter();
    const hasRealInteractions = interactions.some((i) => i.id !== INTERNAL_RENDER_CALL_ID);
    const isListBusy = status === 'rendering' || status === 'playing';
    const statusAnnouncement = getStatusAnnouncement(status, hasException);
    const isStatusAlert = status === 'errored' || (status === 'completed' && hasException);

    return (
      <Container>
        {hasResultMismatch && <TestDiscrepancyMessage browserTestStatus={browserTestStatus} />}
        {controlStates.detached && (hasRealInteractions || hasException) && (
          <DetachedDebuggerMessage storyUrl={storyUrl} />
        )}
        <Toolbar
          controls={controls}
          controlStates={controlStates}
          status={status}
          storyFileName={fileName}
          onScrollToEnd={onScrollToEnd}
          importPath={importPath}
          canOpenInEditor={canOpenInEditor}
          api={api}
        />
        <LiveStatus
          role={isStatusAlert ? 'alert' : 'status'}
          aria-live={isStatusAlert ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {statusAnnouncement}
        </LiveStatus>
        <InteractionsSection>
          <InteractionsHeading>Interaction steps</InteractionsHeading>
          <InteractionsList aria-busy={isListBusy}>
            {interactions.map((call) => (
              <Interaction
                key={call.id}
                call={call}
                callsById={calls}
                controls={controls}
                controlStates={controlStates}
                childCallIds={call.childCallIds}
                isHidden={call.isHidden}
                isCollapsed={call.isCollapsed}
                toggleCollapsed={call.toggleCollapsed}
                pausedAt={pausedAt}
              />
            ))}
          </InteractionsList>
        </InteractionsSection>
        {caughtException && !isTestAssertionError(caughtException) && (
          <CaughtException>
            <CaughtExceptionTitle>
              Caught exception in <CaughtExceptionCode>play</CaughtExceptionCode> function
            </CaughtExceptionTitle>
            <CaughtExceptionStack
              data-chromatic="ignore"
              dangerouslySetInnerHTML={{
                __html: filter.toHtml(printSerializedError(caughtException)),
              }}
            ></CaughtExceptionStack>
          </CaughtException>
        )}
        {unhandledErrors && (
          <CaughtException>
            <CaughtExceptionTitle>Unhandled Errors</CaughtExceptionTitle>
            <CaughtExceptionDescription>
              Found {unhandledErrors.length} unhandled error{unhandledErrors.length > 1 ? 's' : ''}{' '}
              while running the play function. This might cause false positive assertions. Resolve
              unhandled errors or ignore unhandled errors with setting the
              <CaughtExceptionCode>test.dangerouslyIgnoreUnhandledErrors</CaughtExceptionCode>{' '}
              parameter to <CaughtExceptionCode>true</CaughtExceptionCode>.
            </CaughtExceptionDescription>

            {unhandledErrors.map((error, i) => (
              <CaughtExceptionStack key={i} data-chromatic="ignore">
                {printSerializedError(error)}
              </CaughtExceptionStack>
            ))}
          </CaughtException>
        )}
        <div ref={endRef} />
        {status === 'completed' && !caughtException && !hasRealInteractions && <Empty />}
      </Container>
    );
  }
);

export interface SerializedError {
  name: string;
  stack?: string;
  message: string;
}

function printSerializedError(error: SerializedError) {
  return error.stack || `${error.name}: ${error.message}`;
}
