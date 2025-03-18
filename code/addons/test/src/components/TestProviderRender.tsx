import React, { type ComponentProps, type FC, useMemo } from 'react';

import {
  IconButton,
  ListItem,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import { type TestProviderConfig, type TestProviderState } from 'storybook/internal/core-events';

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
import { type TestStatus } from '../node/reporter';
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
const statusMap: Record<TestStatus | 'unknown', ComponentProps<typeof TestStatusIcon>['status']> = {
  failed: 'negative',
  warning: 'warning',
  passed: 'positive',
  skipped: 'unknown',
  pending: 'pending',
  unknown: 'unknown',
};

type TestProviderRenderProps = {
  api: API;
  state: TestProviderConfig & TestProviderState<Details>;
  entryId?: string;
} & ComponentProps<typeof Container>;

export const TestProviderRender: FC<TestProviderRenderProps> = ({
  state,
  api,
  entryId,
  ...props
}) => {
  const coverageSummary = state.details?.coverageSummary;

  const isA11yAddon = addons.experimental_getRegisteredAddons().includes(A11Y_ADDON_ID);

  const [{ config, watching }, setStoreState] = experimental_useUniversalStore(store);

  const isStoryEntry = entryId?.includes('--') ?? false;

  const a11yResults = useMemo(() => {
    if (!isA11yAddon) {
      return [];
    }

    return state.details?.testResults?.flatMap((result) =>
      result.results
        .filter(Boolean)
        .filter((r) => !entryId || r.storyId === entryId || r.storyId?.startsWith(`${entryId}-`))
        .map((r) => r.reports.find((report) => report.type === 'a11y'))
    );
  }, [isA11yAddon, state.details?.testResults, entryId]);

  const a11yStatus = useMemo<'positive' | 'warning' | 'negative' | 'pending' | 'unknown'>(() => {
    if (!isA11yAddon || config.a11y === false) {
      return 'unknown';
    }

    if (state.running) {
      return 'pending';
    }

    const definedA11yResults = a11yResults?.filter(Boolean) ?? [];

    if (!definedA11yResults || definedA11yResults.length === 0) {
      return 'unknown';
    }

    const failed = definedA11yResults.some((result) => result?.status === 'failed');
    const warning = definedA11yResults.some((result) => result?.status === 'warning');

    if (failed) {
      return 'negative';
    } else if (warning) {
      return 'warning';
    }

    return 'positive';
  }, [state.running, isA11yAddon, config.a11y, a11yResults]);

  const a11yNotPassedAmount = config?.a11y
    ? a11yResults?.filter((result) => result?.status === 'failed' || result?.status === 'warning')
        .length
    : undefined;

  const a11ySkippedAmount =
    state.running || !config?.a11y ? null : a11yResults?.filter((result) => !result).length;

  const a11ySkippedSuffix = a11ySkippedAmount
    ? a11ySkippedAmount === 1 && isStoryEntry
      ? ' (skipped)'
      : ` (${a11ySkippedAmount} skipped)`
    : '';

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

  const componentTestsNotPassedAmount = results?.filter(
    (result) => result.status === 'failed'
  ).length;

  const status = results[0]?.status ?? (state.running ? 'pending' : 'unknown');

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
          <Title id="testing-module-title" crashed={state.crashed}>
            {state.crashed ? 'Local tests failed' : 'Run local tests'}
          </Title>
          <Description
            id="testing-module-description"
            state={state}
            entryId={entryId}
            results={results}
            watching={watching}
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
                disabled={state.running}
              >
                <EyeIcon />
              </IconButton>
            </WithTooltip>
          )}
          {state.runnable && (
            <>
              {state.running && state.cancellable ? (
                <WithTooltip
                  hasChrome={false}
                  trigger="hover"
                  tooltip={<TooltipNote note="Stop test run" />}
                >
                  <IconButton
                    aria-label="Stop test run"
                    padding="none"
                    size="medium"
                    onClick={() => api.cancelTestProvider(state.id)}
                    disabled={state.cancelling}
                  >
                    <Progress percentage={state.progress?.percentageCompleted}>
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
                          // TODO: add storyIds based on entryId
                        },
                      })
                    }
                    disabled={state.running}
                  >
                    <PlayHollowIcon />
                  </IconButton>
                </WithTooltip>
              )}
            </>
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
              <TooltipNote note={status === 'failed' ? 'View error' : 'View test details'} />
            }
          >
            <IconButton size="medium" disabled={!results?.length} onClick={openTestsPanel}>
              {state.crashed ? (
                <TestStatusIcon status="critical" aria-label="Test status: crashed" />
              ) : (
                <TestStatusIcon status={statusMap[status]} aria-label={`Test status: ${status}`} />
              )}
              {componentTestsNotPassedAmount || null}
            </IconButton>
          </WithTooltip>
        </Row>

        {!entryId && (
          <>
            {coverageSummary ? (
              <Row>
                <ListItem
                  as="label"
                  title="Coverage"
                  icon={
                    entryId ? null : (
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
                    )
                  }
                />
                <WithTooltip
                  hasChrome={false}
                  trigger="hover"
                  tooltip={<TooltipNote note="View report" />}
                >
                  <IconButton asChild size="medium">
                    <a
                      href="/coverage/index.html"
                      target="_blank"
                      aria-label="Open coverage report"
                    >
                      <TestStatusIcon
                        percentage={coverageSummary.percentage}
                        status={coverageSummary.status}
                        aria-label={`Coverage status: ${coverageSummary.status}`}
                      />
                      {coverageSummary.percentage ? (
                        <span aria-label={`${coverageSummary.percentage} percent coverage`}>
                          {coverageSummary.percentage}%
                        </span>
                      ) : null}
                    </a>
                  </IconButton>
                </WithTooltip>
              </Row>
            ) : (
              <Row>
                <ListItem
                  as="label"
                  title={watching ? <Muted>Coverage (unavailable)</Muted> : <>Coverage</>}
                  icon={
                    entryId ? null : (
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
                    )
                  }
                />
                {watching ? (
                  <WithTooltip
                    hasChrome={false}
                    trigger="hover"
                    tooltip={<TooltipNote note="Coverage is unavailable in watch mode" />}
                  >
                    <IconButton size="medium" disabled>
                      <InfoIcon aria-label="Coverage is unavailable in watch mode" />
                    </IconButton>
                  </WithTooltip>
                ) : (
                  <WithTooltip
                    hasChrome={false}
                    trigger="hover"
                    tooltip={
                      <TooltipNote
                        note={
                          state.running && config.coverage
                            ? 'Calculating...'
                            : 'Run tests to calculate coverage'
                        }
                      />
                    }
                  >
                    <IconButton size="medium" disabled>
                      <TestStatusIcon
                        status={state.running && config.coverage ? 'pending' : 'unknown'}
                        aria-label={`Coverage status: unknown`}
                      />
                    </IconButton>
                  </WithTooltip>
                )}
              </Row>
            )}
          </>
        )}

        {isA11yAddon && (
          <Row>
            <ListItem
              as="label"
              title={`Accessibility${a11ySkippedSuffix}`}
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
                    state.running && config.a11y
                      ? 'Testing in progress'
                      : 'View accessibility results'
                  }
                />
              }
            >
              <IconButton size="medium" disabled={!a11yResults?.length} onClick={openA11yPanel}>
                <TestStatusIcon
                  status={a11yStatus}
                  aria-label={`Accessibility status: ${a11yStatus}`}
                />
                {isStoryEntry ? null : a11yNotPassedAmount || null}
              </IconButton>
            </WithTooltip>
          </Row>
        )}
      </Extras>
    </Container>
  );
};
