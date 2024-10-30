import * as React from 'react';

import { styled } from 'storybook/internal/theming';
import type { StoryId } from 'storybook/internal/types';

import type { CallStates } from '@storybook/instrumenter';
import { type Call, type ControlStates } from '@storybook/instrumenter';

import { transparentize } from 'polished';

import { isTestAssertionError, useAnsiToHtmlFilter } from '../utils';
import { Empty } from './EmptyState';
import { Interaction } from './Interaction';
import { Subnav } from './Subnav';
import { TestDiscrepancyMessage } from './TestDiscrepancyMessage';

export interface Controls {
  start: (args: any) => void;
  back: (args: any) => void;
  goto: (args: any) => void;
  next: (args: any) => void;
  end: (args: any) => void;
  rerun: (args: any) => void;
  toggleDemoMode: (args: any) => void;
}

interface InteractionsPanelProps {
  controls: Controls;
  controlStates: ControlStates;
  interactions: (Call & {
    status?: CallStates;
    childCallIds: Call['id'][];
    isHidden: boolean;
    isCollapsed: boolean;
    toggleCollapsed: () => void;
  })[];
  fileName?: string;
  hasException?: boolean;
  caughtException?: Error;
  unhandledErrors?: SerializedError[];
  isPlaying?: boolean;
  pausedAt?: Call['id'];
  calls: Map<string, any>;
  endRef?: React.Ref<HTMLDivElement>;
  onScrollToEnd?: () => void;
  hasResultMismatch?: boolean;
  browserTestStatus?: CallStates;
  storyId: StoryId;
  testRunId: string;
}

const Container = styled.div(({ theme }) => ({
  height: '100%',
  background: theme.background.content,
}));

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

export const InteractionsPanel: React.FC<InteractionsPanelProps> = React.memo(
  function InteractionsPanel({
    calls,
    controls,
    controlStates,
    interactions,
    fileName,
    hasException,
    caughtException,
    unhandledErrors,
    isPlaying,
    pausedAt,
    onScrollToEnd,
    endRef,
    hasResultMismatch,
    browserTestStatus,
    storyId,
    testRunId,
  }) {
    const filter = useAnsiToHtmlFilter();

    return (
      <Container>
        {hasResultMismatch && (
          <TestDiscrepancyMessage
            browserTestStatus={browserTestStatus}
            storyId={storyId}
            testRunId={testRunId}
          />
        )}
        {(interactions.length > 0 || hasException) && (
          <Subnav
            controls={controls}
            controlStates={controlStates}
            status={browserTestStatus}
            storyFileName={fileName}
            onScrollToEnd={onScrollToEnd}
          />
        )}
        <div aria-label="Interactions list">
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
        </div>
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
        {!isPlaying && !caughtException && interactions.length === 0 && <Empty />}
      </Container>
    );
  }
);

interface SerializedError {
  name: string;
  stack?: string;
  message: string;
}

function printSerializedError(error: SerializedError) {
  return error.stack || `${error.name}: ${error.message}`;
}
