import React, { type ComponentProps, type FC, useCallback, useMemo, useRef, useState } from 'react';

import { Button, ListItem, ProgressSpinner } from 'storybook/internal/components';
import {
  TESTING_MODULE_CONFIG_CHANGE,
  type TestProviderConfig,
  type TestProviderState,
} from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/manager-api';
import type { API } from 'storybook/internal/manager-api';
import { styled, useTheme } from 'storybook/internal/theming';

import {
  AccessibilityIcon,
  EditIcon,
  EyeIcon,
  PlayHollowIcon,
  PointerHandIcon,
  ShieldIcon,
  StopAltIcon,
} from '@storybook/icons';

import { isEqual } from 'es-toolkit';
import { debounce } from 'es-toolkit/compat';

import {
  ADDON_ID as A11Y_ADDON_ID,
  PANEL_ID as A11y_ADDON_PANEL_ID,
} from '../../../a11y/src/constants';
import { type Config, type Details, PANEL_ID } from '../constants';
import { type TestStatus } from '../node/reporter';
import { Description } from './Description';
import { TestStatusIcon } from './TestStatusIcon';
import { Title } from './Title';

const Container = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const Heading = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 2px',
  gap: 12,
});

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 6,
  minWidth: 0,
});

const Actions = styled.div({
  display: 'flex',
  gap: 2,
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

const Progress = styled(ProgressSpinner)({
  margin: 2,
});

const StopIcon = styled(StopAltIcon)({
  width: 10,
});

const ItemTitle = styled.span<{ enabled?: boolean }>(
  ({ enabled, theme }) =>
    !enabled && {
      color: theme.textMutedColor,
      '&:after': {
        content: '" (disabled)"',
      },
    }
);

const statusOrder: TestStatus[] = ['failed', 'warning', 'pending', 'passed', 'skipped'];
const statusMap: Record<TestStatus, ComponentProps<typeof TestStatusIcon>['status']> = {
  failed: 'negative',
  warning: 'warning',
  passed: 'positive',
  skipped: 'unknown',
  pending: 'unknown',
};

export const TestProviderRender: FC<
  {
    api: API;
    state: TestProviderConfig & TestProviderState<Details, Config>;
    entryId?: string;
  } & ComponentProps<typeof Container>
> = ({ state, api, entryId, ...props }) => {
  const [isEditing, setIsEditing] = useState(false);
  const theme = useTheme();
  const coverageSummary = state.details?.coverageSummary;

  const isA11yAddon = addons.experimental_getRegisteredAddons().includes(A11Y_ADDON_ID);

  const [config, updateConfig] = useConfig(
    api,
    state.id,
    state.config || { a11y: false, coverage: false }
  );

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

    if (!a11yResults) {
      return 'unknown';
    }

    const failed = a11yResults.some((result) => result?.status === 'failed');
    const warning = a11yResults.some((result) => result?.status === 'warning');

    if (failed) {
      return 'negative';
    } else if (warning) {
      return 'warning';
    }

    return 'positive';
  }, [state.running, isA11yAddon, config.a11y, a11yResults]);

  const a11yNotPassedAmount = a11yResults?.filter(
    (result) => result?.status === 'failed' || result?.status === 'warning'
  ).length;

  const storyId = entryId?.includes('--') ? entryId : undefined;
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

  const status = state.running
    ? 'unknown'
    : state.failed
      ? 'failed'
      : (results[0]?.status ?? 'unknown');

  const openPanel = (id: string, panelId: string) => {
    api.selectStory(id);
    api.setSelectedPanel(panelId);
    api.togglePanel(true);
  };

  return (
    <Container {...props}>
      <Heading>
        <Info>
          <Title id="testing-module-title" state={state} />
          <Description id="testing-module-description" state={state} />
        </Info>

        <Actions>
          <Button
            aria-label={`${isEditing ? 'Close' : 'Open'} settings for ${state.name}`}
            variant="ghost"
            padding="small"
            active={isEditing}
            disabled={state.running && !isEditing}
            onClick={() => setIsEditing(!isEditing)}
          >
            <EditIcon />
          </Button>
          {state.watchable && !entryId && (
            <Button
              aria-label={`${state.watching ? 'Disable' : 'Enable'} watch mode for ${state.name}`}
              variant="ghost"
              padding="small"
              active={state.watching}
              onClick={() => api.setTestProviderWatchMode(state.id, !state.watching)}
              disabled={state.running || isEditing}
            >
              <EyeIcon />
            </Button>
          )}
          {state.runnable && (
            <>
              {state.running && state.cancellable ? (
                <Button
                  aria-label={`Stop ${state.name}`}
                  variant="ghost"
                  padding="none"
                  onClick={() => api.cancelTestProvider(state.id)}
                  disabled={state.cancelling}
                >
                  <Progress percentage={state.progress?.percentageCompleted}>
                    <StopIcon />
                  </Progress>
                </Button>
              ) : (
                <Button
                  aria-label={`Start ${state.name}`}
                  variant="ghost"
                  padding="small"
                  onClick={() => api.runTestProvider(state.id, { entryId })}
                  disabled={state.running || isEditing}
                >
                  <PlayHollowIcon />
                </Button>
              )}
            </>
          )}
        </Actions>
      </Heading>

      {isEditing ? (
        <Extras>
          <ListItem
            as="label"
            title="Component tests"
            icon={<PointerHandIcon color={theme.textMutedColor} />}
            right={<Checkbox type="checkbox" checked disabled />}
          />
          <ListItem
            as="label"
            title={<ItemTitle enabled={config.coverage}>Coverage</ItemTitle>}
            icon={<ShieldIcon color={theme.textMutedColor} />}
            right={
              <Checkbox
                type="checkbox"
                checked={state.watching ? false : config.coverage}
                disabled={state.watching}
                onChange={() => updateConfig({ coverage: !config.coverage })}
              />
            }
          />
          {isA11yAddon && (
            <ListItem
              as="label"
              title={<ItemTitle enabled={config.a11y}>Accessibility</ItemTitle>}
              icon={<AccessibilityIcon color={theme.textMutedColor} />}
              right={
                <Checkbox
                  type="checkbox"
                  checked={config.a11y}
                  onChange={() => updateConfig({ a11y: !config.a11y })}
                />
              }
            />
          )}
        </Extras>
      ) : (
        <Extras>
          <ListItem
            title="Component tests"
            onClick={
              (status === 'failed' || status === 'warning') && results.length
                ? () => {
                    const firstNotPassed = results.find(
                      (r) => r.status === 'failed' || r.status === 'warning'
                    );
                    openPanel(firstNotPassed.storyId, PANEL_ID);
                  }
                : null
            }
            icon={
              state.crashed ? (
                <TestStatusIcon status="critical" aria-label="status: crashed" />
              ) : status === 'unknown' ? (
                <TestStatusIcon status="unknown" aria-label="status: unknown" />
              ) : (
                <TestStatusIcon status={statusMap[status]} aria-label={`status: ${status}`} />
              )
            }
          />
          {coverageSummary ? (
            <ListItem
              title={<ItemTitle enabled={config.coverage}>Coverage</ItemTitle>}
              href={'/coverage/index.html'}
              // @ts-expect-error ListItem doesn't include all anchor attributes in types, but it is an achor element
              target="_blank"
              icon={
                <TestStatusIcon
                  percentage={coverageSummary.percentage}
                  status={coverageSummary.status}
                  aria-label={`status: ${coverageSummary.status}`}
                />
              }
              right={`${coverageSummary.percentage}%`}
            />
          ) : (
            <ListItem
              title={<ItemTitle enabled={config.coverage}>Coverage</ItemTitle>}
              icon={<TestStatusIcon status="unknown" aria-label={`status: unknown`} />}
            />
          )}
          {isA11yAddon && (
            <ListItem
              title={<ItemTitle enabled={config.a11y}>Accessibility</ItemTitle>}
              onClick={
                (a11yStatus === 'negative' || a11yStatus === 'warning') && a11yResults.length
                  ? () => {
                      const firstNotPassed = results.find((r) =>
                        r.reports
                          .filter((report) => report.type === 'a11y')
                          .find(
                            (report) => report.status === 'failed' || report.status === 'warning'
                          )
                      );
                      openPanel(firstNotPassed.storyId, A11y_ADDON_PANEL_ID);
                    }
                  : null
              }
              icon={<TestStatusIcon status={a11yStatus} aria-label={`status: ${a11yStatus}`} />}
              right={a11yNotPassedAmount || null}
            />
          )}
        </Extras>
      )}
    </Container>
  );
};

function useConfig(api: API, providerId: string, initialConfig: Config) {
  const [currentConfig, setConfig] = useState<Config>(initialConfig);
  const lastConfig = useRef(initialConfig);

  const saveConfig = useCallback(
    debounce((config: Config) => {
      if (!isEqual(config, lastConfig.current)) {
        api.updateTestProviderState(providerId, { config });
        api.emit(TESTING_MODULE_CONFIG_CHANGE, { providerId, config });
        lastConfig.current = config;
      }
    }, 500),
    [api, providerId]
  );

  const updateConfig = useCallback(
    (update: Partial<Config>) => {
      setConfig((value) => {
        const updated = { ...value, ...update };
        saveConfig(updated);
        return updated;
      });
    },
    [saveConfig]
  );

  return [currentConfig, updateConfig] as const;
}
