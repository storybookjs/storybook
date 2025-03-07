import React, { type ComponentProps, type FC, useMemo, useState } from 'react';

import {
  Button,
  IconButton,
  ListItem,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import { type TestProviderConfig, type TestProviderState } from 'storybook/internal/core-events';
import { addons, experimental_useUniversalStore } from 'storybook/internal/manager-api';
import type { API } from 'storybook/internal/manager-api';
import { styled, useTheme } from 'storybook/internal/theming';

import {
  AccessibilityIcon,
  EditIcon,
  EyeIcon,
  InfoIcon,
  PlayHollowIcon,
  PointerHandIcon,
  ShieldIcon,
  StopAltIcon,
} from '@storybook/icons';

import { store } from '#manager-store';

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
const statusMap: Record<TestStatus, ComponentProps<typeof TestStatusIcon>['status']> = {
  failed: 'negative',
  warning: 'warning',
  passed: 'positive',
  skipped: 'unknown',
  pending: 'pending',
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

  const a11yStatus = useMemo<'positive' | 'warning' | 'negative' | 'unknown'>(() => {
    if (state.running) {
      return 'unknown';
    }

    if (!isA11yAddon || config.a11y === false) {
      return 'unknown';
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

  const a11ySkippedLabel = a11ySkippedAmount
    ? a11ySkippedAmount === 1 && isStoryEntry
      ? '(skipped)'
      : `(${a11ySkippedAmount} skipped)`
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

  const status = results[0]?.status ?? (state.running ? 'pending' : 'unknown');

  const openPanel = (id: string, panelId: string) => {
    api.selectStory(id);
    api.setSelectedPanel(panelId);
    api.togglePanel(true);
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
                    onClick={() => api.runTestProvider(state.id, { entryId })}
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
            icon={<Checkbox type="checkbox" checked disabled />}
          />
          <IconButton
            size="medium"
            onClick={
              (status === 'failed' || status === 'warning') && results.length
                ? () => {
                    const firstNotPassed = results.find(
                      (r) => r.status === 'failed' || r.status === 'warning'
                    );
                    if (firstNotPassed) {
                      openPanel(firstNotPassed.storyId, PANEL_ID);
                    }
                  }
                : undefined
            }
          >
            {state.crashed ? (
              <TestStatusIcon status="critical" aria-label="status: crashed" />
            ) : // @ts-expect-error TS got its inference wrong
            status === 'unknown' ? (
              <TestStatusIcon status="unknown" aria-label="status: unknown" />
            ) : (
              <TestStatusIcon status={statusMap[status]} aria-label={`status: ${status}`} />
            )}
          </IconButton>
        </Row>

        {!entryId && (
          <>
            {coverageSummary ? (
              <Row>
                <ListItem
                  as="label"
                  title="Coverage"
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
                <IconButton asChild size="medium">
                  <a href="/coverage/index.html" target="_blank" aria-label="Open coverage report">
                    <TestStatusIcon
                      percentage={coverageSummary.percentage}
                      status={coverageSummary.status}
                      aria-label={`status: ${coverageSummary.status}`}
                    />
                    {coverageSummary.percentage ? (
                      <span aria-label={`${coverageSummary.percentage} percent coverage`}>
                        {coverageSummary.percentage}%
                      </span>
                    ) : null}
                  </a>
                </IconButton>
              </Row>
            ) : (
              <Row>
                <ListItem
                  as="label"
                  title={watching ? <Muted>Coverage (unavailable)</Muted> : <>Coverage</>}
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
                {watching ? (
                  <WithTooltip
                    hasChrome={false}
                    trigger="hover"
                    tooltip={<TooltipNote note="Coverage is unavailable in watch mode" />}
                  >
                    <IconButton size="medium">
                      <InfoIcon />
                    </IconButton>
                  </WithTooltip>
                ) : (
                  <IconButton size="medium">
                    <TestStatusIcon status="unknown" aria-label={`status: unknown`} />
                  </IconButton>
                )}
              </Row>
            )}

            {isA11yAddon && (
              <Row>
                <ListItem
                  as="label"
                  title={`Accessibility ${a11ySkippedLabel}`}
                  onClick={
                    (a11yStatus === 'negative' || a11yStatus === 'warning') && a11yResults.length
                      ? () => {
                          const firstNotPassed = results.find((r) =>
                            r.reports
                              .filter((report) => report.type === 'a11y')
                              .find(
                                (report) =>
                                  report.status === 'failed' || report.status === 'warning'
                              )
                          );
                          if (firstNotPassed) {
                            openPanel(firstNotPassed.storyId, A11y_ADDON_PANEL_ID);
                          }
                        }
                      : undefined
                  }
                  icon={
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
                  }
                />
                <IconButton size="medium">
                  <TestStatusIcon status={a11yStatus} aria-label={`status: ${a11yStatus}`} />
                  {isStoryEntry ? null : a11yNotPassedAmount || null}
                </IconButton>
              </Row>
            )}
          </>
        )}
      </Extras>
    </Container>
  );
};
