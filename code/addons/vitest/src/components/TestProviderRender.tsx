import React, { type ComponentProps, type FC } from 'react';

import {
  IconButton,
  ListItem,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import type { API_HashEntry, TestProviderState } from 'storybook/internal/types';

import { EyeIcon, InfoIcon, PlayHollowIcon, StopAltIcon } from '@storybook/icons';

import { store } from '#manager-store';
import { addons } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { A11Y_ADDON_ID, A11Y_PANEL_ID, PANEL_ID } from '../constants';
import type { StoreState } from '../types';
import type { StatusValueToStoryIds } from '../use-test-provider-state';
import { Description } from './Description';
import { TestStatusIcon } from './TestStatusIcon';

const Container = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const Heading = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  gap: 12,
});

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 8,
  minWidth: 0,
});

const Title = styled.div<{ crashed?: boolean }>(({ crashed, theme }) => ({
  fontSize: theme.typography.size.s1,
  fontWeight: crashed ? 'bold' : 'normal',
  color: crashed ? theme.color.negativeText : theme.color.defaultText,
}));

const Actions = styled.div({
  display: 'flex',
  gap: 4,
});

const Extras = styled.div({
  marginBottom: 2,
});

const Checkbox = styled.input({
  margin: 0,
  '&:enabled': {
    cursor: 'pointer',
  },
});

const Muted = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Progress = styled(ProgressSpinner)({
  margin: 4,
});

const Row = styled.div({
  display: 'flex',
  gap: 4,
});

const StopIcon = styled(StopAltIcon)({
  width: 10,
});

const openPanel = ({ api, panelId, entryId }: { api: API; panelId: string; entryId?: string }) => {
  const story = entryId ? api.findAllLeafStoryIds(entryId)[0] : undefined;
  if (story) {
    api.selectStory(story);
  }
  api.setSelectedPanel(panelId);
  api.togglePanel(true);
};

type TestProviderRenderProps = {
  api: API;
  testProviderState: TestProviderState;
  componentTestStatusValueToStoryIds: StatusValueToStoryIds;
  a11yStatusValueToStoryIds: StatusValueToStoryIds;
  storeState: StoreState;
  setStoreState: (typeof store)['setState'];
  isSettingsUpdated: boolean;
  entry?: API_HashEntry;
} & ComponentProps<typeof Container>;

export const TestProviderRender: FC<TestProviderRenderProps> = ({
  api,
  entry,
  testProviderState,
  storeState,
  setStoreState,
  componentTestStatusValueToStoryIds,
  a11yStatusValueToStoryIds,
  isSettingsUpdated,
  ...props
}) => {
  const { config, watching, cancelling, currentRun, fatalError } = storeState;
  const finishedTestCount =
    currentRun.componentTestCount.success + currentRun.componentTestCount.error;

  const hasA11yAddon = addons.experimental_getRegisteredAddons().includes(A11Y_ADDON_ID);

  const isRunning = testProviderState === 'test-provider-state:running';
  const isStarting = isRunning && finishedTestCount === 0;

  const [componentTestStatusIcon, componentTestStatusLabel]: [
    ComponentProps<typeof TestStatusIcon>['status'],
    string,
  ] = fatalError
    ? ['critical', 'Local tests crashed']
    : componentTestStatusValueToStoryIds['status-value:error'].length > 0
      ? ['negative', 'Component tests failed']
      : isRunning
        ? ['unknown', 'Testing in progress']
        : componentTestStatusValueToStoryIds['status-value:success'].length > 0
          ? ['positive', 'Component tests passed']
          : ['unknown', 'Run tests to see results'];

  const [a11yStatusIcon, a11yStatusLabel]: [
    ComponentProps<typeof TestStatusIcon>['status'],
    string,
  ] = fatalError
    ? ['critical', 'Local tests crashed']
    : a11yStatusValueToStoryIds['status-value:error'].length > 0
      ? ['negative', 'Accessibility tests failed']
      : a11yStatusValueToStoryIds['status-value:warning'].length > 0
        ? ['warning', 'Accessibility tests failed']
        : isRunning
          ? ['unknown', 'Testing in progress']
          : a11yStatusValueToStoryIds['status-value:success'].length > 0
            ? ['positive', 'Accessibility tests passed']
            : ['unknown', 'Run tests to see accessibility results'];

  return (
    <Container {...props}>
      <Heading>
        <Info>
          <Title
            id="testing-module-title"
            crashed={
              testProviderState === 'test-provider-state:crashed' ||
              fatalError !== undefined ||
              currentRun.unhandledErrors.length > 0
            }
          >
            {currentRun.unhandledErrors.length === 1
              ? 'Local tests completed with an error'
              : currentRun.unhandledErrors.length > 1
                ? 'Local tests completed with errors'
                : fatalError
                  ? 'Local tests didn’t complete'
                  : 'Run local tests'}
          </Title>
          <Description
            id="testing-module-description"
            storeState={storeState}
            testProviderState={testProviderState}
            entryId={entry?.id}
            isSettingsUpdated={isSettingsUpdated}
          />
        </Info>

        <Actions>
          {!entry && (
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={<TooltipNote note={`${watching ? 'Disable' : 'Enable'} watch mode`} />}
            >
              <IconButton
                aria-label={`${watching ? 'Disable' : 'Enable'} watch mode`}
                size="medium"
                active={watching}
                onClick={() =>
                  store.send({
                    type: 'TOGGLE_WATCHING',
                    payload: {
                      to: !watching,
                    },
                  })
                }
                disabled={isRunning}
              >
                <EyeIcon />
              </IconButton>
            </WithTooltip>
          )}
          {isRunning ? (
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={<TooltipNote note={cancelling ? 'Stopping...' : 'Stop test run'} />}
            >
              <IconButton
                aria-label={cancelling ? 'Stopping...' : 'Stop test run'}
                padding="none"
                size="medium"
                onClick={() =>
                  store.send({
                    type: 'CANCEL_RUN',
                  })
                }
                disabled={cancelling || isStarting}
              >
                <Progress
                  percentage={
                    finishedTestCount && storeState.currentRun.totalTestCount
                      ? (finishedTestCount / storeState.currentRun.totalTestCount) * 100
                      : undefined
                  }
                >
                  <StopIcon />
                </Progress>
              </IconButton>
            </WithTooltip>
          ) : (
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={<TooltipNote note="Start test run" />}
            >
              <IconButton
                aria-label="Start test run"
                size="medium"
                onClick={() =>
                  store.send({
                    type: 'TRIGGER_RUN',
                    payload: {
                      storyIds: entry ? api.findAllLeafStoryIds(entry.id) : undefined,
                      triggeredBy: entry ? entry.type : 'global',
                    },
                  })
                }
              >
                <PlayHollowIcon />
              </IconButton>
            </WithTooltip>
          )}
        </Actions>
      </Heading>

      <Extras>
        <Row>
          <ListItem
            as="label"
            title="Component tests"
            icon={entry ? null : <Checkbox type="checkbox" checked disabled />}
          />
          <WithTooltip
            hasChrome={false}
            trigger="hover"
            tooltip={<TooltipNote note={componentTestStatusLabel} />}
          >
            <IconButton
              size="medium"
              disabled={
                componentTestStatusValueToStoryIds['status-value:error'].length === 0 &&
                componentTestStatusValueToStoryIds['status-value:warning'].length === 0 &&
                componentTestStatusValueToStoryIds['status-value:success'].length === 0
              }
              onClick={() => {
                openPanel({
                  api,
                  panelId: PANEL_ID,
                  entryId:
                    componentTestStatusValueToStoryIds['status-value:error'][0] ??
                    componentTestStatusValueToStoryIds['status-value:warning'][0] ??
                    componentTestStatusValueToStoryIds['status-value:success'][0] ??
                    entry?.id,
                });
              }}
            >
              <TestStatusIcon
                status={componentTestStatusIcon}
                aria-label={componentTestStatusLabel}
                isRunning={isRunning}
              />
              {componentTestStatusValueToStoryIds['status-value:error'].length +
                componentTestStatusValueToStoryIds['status-value:warning'].length || null}
            </IconButton>
          </WithTooltip>
        </Row>

        {!entry && (
          <Row>
            <ListItem
              as="label"
              title={watching ? <Muted>Coverage (unavailable)</Muted> : 'Coverage'}
              icon={
                <Checkbox
                  type="checkbox"
                  checked={config.coverage}
                  disabled={isRunning}
                  onChange={() =>
                    setStoreState((s) => ({
                      ...s,
                      config: { ...s.config, coverage: !config.coverage },
                    }))
                  }
                />
              }
            />
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={
                <TooltipNote
                  note={
                    watching
                      ? 'Unavailable in watch mode'
                      : currentRun.triggeredBy && currentRun.triggeredBy !== 'global'
                        ? 'Unavailable when running focused tests'
                        : isRunning
                          ? 'Testing in progress'
                          : currentRun.coverageSummary
                            ? 'View coverage report'
                            : fatalError
                              ? 'Local tests crashed'
                              : 'Run tests to calculate coverage'
                  }
                />
              }
            >
              {watching || (currentRun.triggeredBy && currentRun.triggeredBy !== 'global') ? (
                <IconButton size="medium" disabled>
                  <InfoIcon
                    aria-label={
                      watching
                        ? `Coverage is unavailable in watch mode`
                        : `Coverage is unavailable when running focused tests`
                    }
                  />
                </IconButton>
              ) : currentRun.coverageSummary ? (
                <IconButton asChild size="medium">
                  <a href="/coverage/index.html" target="_blank" aria-label="Open coverage report">
                    <TestStatusIcon
                      isRunning={isRunning}
                      percentage={currentRun.coverageSummary.percentage}
                      status={currentRun.coverageSummary.status}
                      aria-label={`Coverage status: ${currentRun.coverageSummary.status}`}
                    />
                    <span aria-label={`${currentRun.coverageSummary.percentage} percent coverage`}>
                      {currentRun.coverageSummary.percentage}%
                    </span>
                  </a>
                </IconButton>
              ) : (
                <IconButton size="medium" disabled>
                  <TestStatusIcon
                    isRunning={isRunning}
                    status={fatalError ? 'critical' : 'unknown'}
                    aria-label="Coverage status: unknown"
                  />
                </IconButton>
              )}
            </WithTooltip>
          </Row>
        )}

        {hasA11yAddon && (
          <Row>
            <ListItem
              as="label"
              title="Accessibility"
              icon={
                entry ? null : (
                  <Checkbox
                    type="checkbox"
                    checked={config.a11y}
                    disabled={isRunning}
                    onChange={() =>
                      setStoreState((s) => ({
                        ...s,
                        config: { ...s.config, a11y: !config.a11y },
                      }))
                    }
                  />
                )
              }
            />
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={<TooltipNote note={a11yStatusLabel} />}
            >
              <IconButton
                size="medium"
                disabled={
                  a11yStatusValueToStoryIds['status-value:error'].length === 0 &&
                  a11yStatusValueToStoryIds['status-value:warning'].length === 0 &&
                  a11yStatusValueToStoryIds['status-value:success'].length === 0
                }
                onClick={() => {
                  openPanel({
                    api,
                    entryId:
                      a11yStatusValueToStoryIds['status-value:error'][0] ??
                      a11yStatusValueToStoryIds['status-value:warning'][0] ??
                      a11yStatusValueToStoryIds['status-value:success'][0] ??
                      entry?.id,
                    panelId: A11Y_PANEL_ID,
                  });
                }}
              >
                <TestStatusIcon
                  status={a11yStatusIcon}
                  aria-label={a11yStatusLabel}
                  isRunning={isRunning}
                />
                {a11yStatusValueToStoryIds['status-value:error'].length +
                  a11yStatusValueToStoryIds['status-value:warning'].length || null}
              </IconButton>
            </WithTooltip>
          </Row>
        )}
      </Extras>
    </Container>
  );
};
