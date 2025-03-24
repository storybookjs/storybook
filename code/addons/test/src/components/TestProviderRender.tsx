import React, { type ComponentProps, type FC, useCallback } from 'react';

import {
  IconButton,
  ListItem,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import type { TestProviderState } from 'storybook/internal/types';

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

type TestProviderRenderProps = {
  api: API;
  testProviderState: TestProviderState;
  componentTestStatusValueToStoryIds: StatusValueToStoryIds;
  a11yStatusValueToStoryIds: StatusValueToStoryIds;
  storeState: StoreState;
  setStoreState: (typeof store)['setState'];
  isSettingsUpdated: boolean;
  entryId?: string;
} & ComponentProps<typeof Container>;

export const TestProviderRender: FC<TestProviderRenderProps> = ({
  api,
  entryId,
  testProviderState,
  storeState,
  setStoreState,
  componentTestStatusValueToStoryIds,
  a11yStatusValueToStoryIds,
  isSettingsUpdated,
  ...props
}) => {
  const {
    config,
    watching,
    cancelling,
    currentRun: { coverageSummary, finishedTestCount },
  } = storeState;

  const hasA11yAddon = addons.experimental_getRegisteredAddons().includes(A11Y_ADDON_ID);

  const isRunning = testProviderState === 'test-provider-state:running';
  const isStarting = isRunning && finishedTestCount === 0;

  const [componentTestStatusIcon, componentTestStatusLabel]: [
    ComponentProps<typeof TestStatusIcon>['status'],
    string,
  ] =
    testProviderState === 'test-provider-state:crashed'
      ? ['critical', 'Local tests crashed']
      : componentTestStatusValueToStoryIds['status-value:error'].length > 0
        ? ['negative', 'Component tests failed']
        : isRunning
          ? ['pending', 'Testing in progress']
          : componentTestStatusValueToStoryIds['status-value:success'].length > 0
            ? ['positive', 'Component tests passed']
            : ['unknown', 'Unknown component test status'];

  const [a11yStatusIcon, a11yStatusLabel]: [
    ComponentProps<typeof TestStatusIcon>['status'],
    string,
  ] =
    testProviderState === 'test-provider-state:crashed'
      ? ['critical', 'Local tests crashed']
      : a11yStatusValueToStoryIds['status-value:warning'].length > 0
        ? ['warning', 'Accessibility tests failed']
        : isRunning
          ? ['pending', 'Testing in progress']
          : a11yStatusValueToStoryIds['status-value:success'].length > 0
            ? ['positive', 'Accessibility tests passed']
            : ['unknown', 'Unknown accessibility test status'];

  const firstComponentTestErrorStoryId =
    componentTestStatusValueToStoryIds['status-value:error'][0];
  const openComponentTestPanel = useCallback(() => {
    api.selectStory(firstComponentTestErrorStoryId);
    api.setSelectedPanel(PANEL_ID);
    api.togglePanel(true);
  }, [api, firstComponentTestErrorStoryId]);

  const firstA11yTestWarningStoryId = a11yStatusValueToStoryIds['status-value:warning'][0];
  const openA11yPanel = useCallback(() => {
    api.selectStory(firstA11yTestWarningStoryId);
    api.setSelectedPanel(A11Y_PANEL_ID);
    api.togglePanel(true);
  }, [api, firstA11yTestWarningStoryId]);

  return (
    <Container {...props}>
      <Heading>
        <Info>
          <Title
            id="testing-module-title"
            crashed={testProviderState === 'test-provider-state:crashed'}
          >
            {testProviderState === 'test-provider-state:crashed'
              ? 'Local tests failed'
              : 'Run local tests'}
          </Title>
          <Description
            id="testing-module-description"
            storeState={storeState}
            testProviderState={testProviderState}
            entryId={entryId}
            isSettingsUpdated={isSettingsUpdated}
          />
        </Info>

        <Actions>
          {!entryId && (
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
                    storeState.currentRun.finishedTestCount && storeState.currentRun.totalTestCount
                      ? (storeState.currentRun.finishedTestCount /
                          storeState.currentRun.totalTestCount) *
                        100
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
                    ...(entryId
                      ? {
                          payload: {
                            storyIds: api.findAllLeafStoryIds(entryId),
                          },
                        }
                      : {}),
                  })
                }
                disabled={false}
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
            icon={entryId ? null : <Checkbox type="checkbox" checked disabled />}
          />
          <WithTooltip
            hasChrome={false}
            trigger="hover"
            tooltip={
              <TooltipNote
                note={
                  isRunning
                    ? 'Testing in progress'
                    : testProviderState === 'test-provider-state:crashed'
                      ? 'View error'
                      : 'View test results'
                }
              />
            }
          >
            <IconButton
              size="medium"
              disabled={componentTestStatusValueToStoryIds['status-value:error'].length === 0}
              onClick={openComponentTestPanel}
            >
              <TestStatusIcon
                status={componentTestStatusIcon}
                aria-label={componentTestStatusLabel}
              />
              {componentTestStatusValueToStoryIds['status-value:error'].length || null}
            </IconButton>
          </WithTooltip>
        </Row>

        {!entryId && (
          <Row>
            <ListItem
              as="label"
              title={watching ? <Muted>Coverage (unavailable)</Muted> : 'Coverage'}
              icon={
                <Checkbox
                  type="checkbox"
                  checked={config.coverage}
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
                      ? 'Coverage is unavailable in watch mode'
                      : isRunning && config.coverage
                        ? 'Calculating...'
                        : coverageSummary
                          ? 'View report'
                          : 'Run tests to calculate coverage'
                  }
                />
              }
            >
              {watching ? (
                <IconButton size="medium" disabled>
                  <InfoIcon aria-label="Coverage is unavailable in watch mode" />
                </IconButton>
              ) : coverageSummary ? (
                <IconButton asChild size="medium">
                  <a href="/coverage/index.html" target="_blank" aria-label="Open coverage report">
                    <TestStatusIcon
                      percentage={coverageSummary.percentage}
                      status={coverageSummary.status}
                      aria-label={`Coverage status: ${coverageSummary.status}`}
                    />
                    <span aria-label={`${coverageSummary.percentage} percent coverage`}>
                      {coverageSummary.percentage}%
                    </span>
                  </a>
                </IconButton>
              ) : (
                <IconButton size="medium" disabled>
                  <TestStatusIcon
                    status={isRunning && config.coverage ? 'pending' : 'unknown'}
                    aria-label={`Coverage status: unknown`}
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
                entryId ? null : (
                  <Checkbox
                    type="checkbox"
                    checked={config.a11y}
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
              tooltip={
                <TooltipNote
                  note={
                    isRunning && config.a11y ? 'Testing in progress' : 'View accessibility results'
                  }
                />
              }
            >
              <IconButton
                size="medium"
                disabled={a11yStatusValueToStoryIds['status-value:warning'].length === 0}
                onClick={openA11yPanel}
              >
                <TestStatusIcon status={a11yStatusIcon} aria-label={a11yStatusLabel} />
                {a11yStatusValueToStoryIds['status-value:warning'].length || null}
              </IconButton>
            </WithTooltip>
          </Row>
        )}
      </Extras>
    </Container>
  );
};
