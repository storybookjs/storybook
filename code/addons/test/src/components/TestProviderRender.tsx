import React, {
  type ComponentProps,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Button,
  ListItem,
  ProgressSpinner,
  TooltipNote,
  WithTooltip,
} from 'storybook/internal/components';
import {
  TESTING_MODULE_CONFIG_CHANGE,
  type TestProviderConfig,
  type TestProviderState,
} from 'storybook/internal/core-events';
import { addons, useStorybookState } from 'storybook/internal/manager-api';
import type { API } from 'storybook/internal/manager-api';
import { styled, useTheme } from 'storybook/internal/theming';

import type { Tag } from '@storybook/csf';
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

const Title = styled.div<{ crashed?: boolean }>(({ crashed, theme }) => ({
  fontSize: theme.typography.size.s1,
  fontWeight: crashed ? 'bold' : 'normal',
  color: crashed ? theme.color.negativeText : theme.color.defaultText,
}));

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
  pending: 'pending',
};

type TestProviderRenderProps = {
  api: API;
  state: TestProviderConfig & TestProviderState<Details, Config>;
  entryId?: string;
} & ComponentProps<typeof Container>;

export const TestProviderRender: FC<TestProviderRenderProps> = ({
  state,
  api,
  entryId,
  ...props
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const theme = useTheme();
  const coverageSummary = state.details?.coverageSummary;
  const storybookState = useStorybookState();

  const isA11yAddon = addons.experimental_getRegisteredAddons().includes(A11Y_ADDON_ID);

  const isA11yAddonInitiallyChecked = useMemo(() => {
    const internalIndex = storybookState.internal_index;
    if (!internalIndex || !isA11yAddon) {
      return false;
    }

    return Object.values(internalIndex.entries).some((entry) => entry.tags?.includes('a11y-test'));
  }, [isA11yAddon, storybookState.internal_index]);

  const [config, updateConfig] = useConfig(
    api,
    state.id,
    state.config || { a11y: isA11yAddonInitiallyChecked, coverage: false }
  );

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

  const a11yNotPassedAmount = state.config?.a11y
    ? a11yResults?.filter((result) => result?.status === 'failed' || result?.status === 'warning')
        .length
    : undefined;

  const a11ySkippedAmount =
    state.running || !state?.details.config?.a11y || !state.config?.a11y
      ? null
      : a11yResults?.filter((result) => !result).length;

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
          />
        </Info>

        <Actions>
          {!entryId && (
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={<TooltipNote note={`${isEditing ? 'Hide' : 'Show'} settings`} />}
            >
              <Button
                aria-label={`${isEditing ? 'Hide' : 'Show'} settings`}
                variant="ghost"
                padding="small"
                active={isEditing}
                disabled={state.running && !isEditing}
                onClick={() => setIsEditing(!isEditing)}
              >
                <EditIcon />
              </Button>
            </WithTooltip>
          )}
          {!entryId && state.watchable && (
            <WithTooltip
              hasChrome={false}
              trigger="hover"
              tooltip={<TooltipNote note={`${state.watching ? 'Disable' : 'Enable'} watch mode`} />}
            >
              <Button
                aria-label={`${state.watching ? 'Disable' : 'Enable'} watch mode`}
                variant="ghost"
                padding="small"
                active={state.watching}
                onClick={() => api.setTestProviderWatchMode(state.id, !state.watching)}
                disabled={state.running || isEditing}
              >
                <EyeIcon />
              </Button>
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
                  <Button
                    aria-label="Stop test run"
                    variant="ghost"
                    padding="none"
                    onClick={() => api.cancelTestProvider(state.id)}
                    disabled={state.cancelling}
                  >
                    <Progress percentage={state.progress?.percentageCompleted}>
                      <StopIcon />
                    </Progress>
                  </Button>
                </WithTooltip>
              ) : (
                <WithTooltip
                  hasChrome={false}
                  trigger="hover"
                  tooltip={<TooltipNote note="Start test run" />}
                >
                  <Button
                    aria-label="Start test run"
                    variant="ghost"
                    padding="small"
                    onClick={() => api.runTestProvider(state.id, { entryId })}
                    disabled={state.running || isEditing}
                  >
                    <PlayHollowIcon />
                  </Button>
                </WithTooltip>
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
          {!entryId && (
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
                    if (firstNotPassed) {
                      openPanel(firstNotPassed.storyId, PANEL_ID);
                    }
                  }
                : undefined
            }
            icon={
              state.crashed ? (
                <TestStatusIcon status="critical" aria-label="status: crashed" />
              ) : // @ts-expect-error @ghengeveld should check whether this is a bug or not
              status === 'unknown' ? (
                <TestStatusIcon status="unknown" aria-label="status: unknown" />
              ) : (
                <TestStatusIcon status={statusMap[status]} aria-label={`status: ${status}`} />
              )
            }
          />
          {isA11yAddon && (
            <ListItem
              title={<ItemTitle enabled={config.a11y}>Accessibility {a11ySkippedLabel}</ItemTitle>}
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
                      if (firstNotPassed) {
                        openPanel(firstNotPassed.storyId, A11y_ADDON_PANEL_ID);
                      }
                    }
                  : undefined
              }
              icon={<TestStatusIcon status={a11yStatus} aria-label={`status: ${a11yStatus}`} />}
              right={isStoryEntry ? null : a11yNotPassedAmount || null}
            />
          )}
          {!entryId && (
            <>
              {coverageSummary ? (
                <ListItem
                  title={<ItemTitle enabled={config.coverage}>Coverage</ItemTitle>}
                  href={'/coverage/index.html'}
                  // @ts-expect-error ListItem doesn't include all anchor attributes in types, but it is an achor element
                  target="_blank"
                  aria-label="Open coverage report"
                  icon={
                    <TestStatusIcon
                      percentage={coverageSummary.percentage}
                      status={coverageSummary.status}
                      aria-label={`status: ${coverageSummary.status}`}
                    />
                  }
                  right={
                    coverageSummary.percentage ? (
                      <span aria-label={`${coverageSummary.percentage} percent coverage`}>
                        {coverageSummary.percentage} %
                      </span>
                    ) : null
                  }
                />
              ) : (
                <ListItem
                  title={<ItemTitle enabled={config.coverage}>Coverage</ItemTitle>}
                  icon={<TestStatusIcon status="unknown" aria-label={`status: unknown`} />}
                />
              )}
            </>
          )}
        </Extras>
      )}
    </Container>
  );
};

function useConfig(api: API, providerId: string, initialConfig: Config) {
  const updateTestProviderState = useCallback(
    (config: Config) => {
      api.updateTestProviderState(providerId, { config });
      api.emit(TESTING_MODULE_CONFIG_CHANGE, { providerId, config });
    },
    [api, providerId]
  );

  const [currentConfig, setConfig] = useState<Config>(initialConfig);

  const lastConfig = useRef(initialConfig);

  const saveConfig = useCallback(
    debounce((config: Config) => {
      if (!isEqual(config, lastConfig.current)) {
        updateTestProviderState(config);
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

  useEffect(() => {
    updateTestProviderState(initialConfig);
  }, []);

  return [currentConfig, updateConfig] as const;
}
