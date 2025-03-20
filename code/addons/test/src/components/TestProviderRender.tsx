import React, { type ComponentProps, type FC, useMemo } from 'react';

import {
  IconButton,
  ListItem,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import {
  type TestProviderState as DeprecatedTestProviderState,
  type TestProviderConfig,
} from 'storybook/internal/core-events';
import type { TestProviderState } from 'storybook/internal/types';

import { EyeIcon, InfoIcon, PlayHollowIcon, StopAltIcon } from '@storybook/icons';

import { store } from '#manager-store';
import { addons, experimental_useUniversalStore } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import {
  ADDON_ID as A11Y_ADDON_ID,
  PANEL_ID as A11y_ADDON_PANEL_ID,
} from '../../../a11y/src/constants';
import { type Details, PANEL_ID } from '../constants';
import type { StoreState } from '../constants';
import { type TestStatus } from '../node/old-reporter';
import type { StatusCountsByValue } from '../use-test-provider-state';
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

const statusOrder: TestStatus[] = ['failed', 'warning', 'pending', 'passed', 'skipped'];

type TestProviderRenderProps = {
  api: API;
  state: TestProviderConfig & DeprecatedTestProviderState<Details>;
  testProviderState: TestProviderState;
  componentTestStatusCountsByValue: StatusCountsByValue;
  a11yStatusCountsByValue: StatusCountsByValue;
  storeState: StoreState;
  setStoreState: (typeof store)['setState'];
  entryId?: string;
} & ComponentProps<typeof Container>;

export const TestProviderRender: FC<TestProviderRenderProps> = ({
  state,
  api,
  entryId,
  testProviderState,
  storeState,
  setStoreState,
  componentTestStatusCountsByValue,
  a11yStatusCountsByValue,
  ...props
}) => {
  const {
    config,
    watching,
    cancelling,
    currentRun: { coverageSummary },
  } = storeState;

  const isA11yAddon = addons.experimental_getRegisteredAddons().includes(A11Y_ADDON_ID);

  const isRunning = testProviderState === 'test-provider-state:running';

  const componentTestStatusIcon: ComponentProps<typeof TestStatusIcon>['status'] =
    componentTestStatusCountsByValue['status-value:error'] > 0
      ? 'negative'
      : isRunning
        ? 'pending'
        : componentTestStatusCountsByValue['status-value:success'] > 0
          ? 'positive'
          : 'unknown';
  const a11yStatusIcon: ComponentProps<typeof TestStatusIcon>['status'] =
    a11yStatusCountsByValue['status-value:warning'] > 0
      ? 'warning'
      : isRunning
        ? 'pending'
        : a11yStatusCountsByValue['status-value:success'] > 0
          ? 'positive'
          : 'unknown';

  const isStoryEntry = entryId?.includes('--') ?? false;

  const storyId = isStoryEntry ? entryId : undefined;

  const results = (state.details?.testResults || [])
    .flatMap((test) => {
      if (!entryId) {
        return test.results;
      }
      return test.results.filter((result) =>
        storyId ? result.storyId === storyId : result.storyId?.startsWith(`${entryId}-`)
      );
    })
    .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  const status = results[0]?.status ?? (isRunning ? 'pending' : 'unknown');

  const openPanel = (panelId: string, targetStoryId?: string) => {
    if (targetStoryId) {
      api.selectStory(targetStoryId);
    }
    api.setSelectedPanel(panelId);
    api.togglePanel(true);
  };

  const openTestsPanel = () => {
    const currentStoryId = api.getCurrentStoryData().id;
    const currentStoryNotPassed = results.some(
      (r) => r.storyId === currentStoryId && ['failed', 'warning'].includes(r.status)
    );
    if (currentStoryNotPassed) {
      openPanel(PANEL_ID);
    } else {
      const firstNotPassed = results.find((r) => ['failed', 'warning'].includes(r.status));
      openPanel(PANEL_ID, firstNotPassed?.storyId);
    }
  };

  const openA11yPanel = () => {
    const currentStoryId = api.getCurrentStoryData().id;
    const currentStoryNotPassed = results.some(
      (r) =>
        r.storyId === currentStoryId &&
        r.reports.some((rep) => rep.type === 'a11y' && ['failed', 'warning'].includes(rep.status))
    );
    if (currentStoryNotPassed) {
      openPanel(A11y_ADDON_PANEL_ID);
    } else {
      const firstNotPassed = results.find((r) =>
        r.reports.some((rep) => rep.type === 'a11y' && ['failed', 'warning'].includes(rep.status))
      );
      openPanel(A11y_ADDON_PANEL_ID, firstNotPassed?.storyId);
    }
  };

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
                  setStoreState((s) => ({
                    ...s,
                    watching: !watching,
                  }))
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
                disabled={cancelling}
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
                    payload: {
                      indexUrl: new URL('index.json', window.location.href).toString(),
                      storyIds: entryId ? api.findAllLeafStoryIds(entryId) : undefined,
                    },
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
              disabled={componentTestStatusCountsByValue['status-value:error'] === 0}
              onClick={openTestsPanel}
            >
              {testProviderState === 'test-provider-state:crashed' ? (
                <TestStatusIcon status="critical" aria-label="Test status: crashed" />
              ) : (
                <TestStatusIcon
                  status={componentTestStatusIcon}
                  aria-label={`Test status: ${status}`}
                />
              )}
              {componentTestStatusCountsByValue['status-value:error'] || null}
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
                <IconButton size="medium">
                  <TestStatusIcon
                    status={isRunning && config.coverage ? 'pending' : 'unknown'}
                    aria-label={`Coverage status: unknown`}
                  />
                </IconButton>
              )}
            </WithTooltip>
          </Row>
        )}

        {isA11yAddon && (
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
                disabled={a11yStatusCountsByValue['status-value:warning'] === 0}
                onClick={openA11yPanel}
              >
                <TestStatusIcon
                  status={a11yStatusIcon}
                  aria-label={`Accessibility status: ${a11yStatusIcon}`}
                />
                {a11yStatusCountsByValue['status-value:warning'] || null}
              </IconButton>
            </WithTooltip>
          </Row>
        )}
      </Extras>
    </Container>
  );
};
