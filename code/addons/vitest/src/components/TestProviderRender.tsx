import React, { type ComponentProps, type FC } from 'react';

import {
  ActionList,
  Button,
  Form,
  ProgressSpinner,
  ToggleButton,
} from 'storybook/internal/components';
import type { API_HashEntry, TestProviderState } from 'storybook/internal/types';

import { EyeIcon, InfoIcon, PlayHollowIcon, StopAltIcon } from '@storybook/icons';

import { store } from '#manager-store';
import { addons } from 'storybook/manager-api';
import type { API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import {
  A11Y_ADDON_ID,
  A11Y_PANEL_ID,
  COMPONENT_TESTING_PANEL_ID,
  FULL_RUN_TRIGGERS,
} from '../constants';
import type { StoreState } from '../types';
import type { StatusValueToStoryIds } from '../use-test-provider-state';
import { Description } from './Description';
import { TestStatusIcon } from './TestStatusIcon';

const Container = styled.div<{ inContextMenu?: boolean }>(({ inContextMenu }) => ({
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: inContextMenu ? 0 : 1,
}));

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

const StyledActionList = styled(ActionList)({
  padding: 0,
});

const Muted = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Progress = styled(ProgressSpinner)({
  margin: 4,
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
    ? ['critical', 'Component tests crashed']
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
    ? ['critical', 'Component tests crashed']
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
    <Container {...props} inContextMenu={!!entry}>
      <Heading>
        <Info>
          {entry ? (
            <Title id="testing-module-title">Run component tests</Title>
          ) : (
            <Title
              id="testing-module-title"
              crashed={
                testProviderState === 'test-provider-state:crashed' ||
                fatalError !== undefined ||
                currentRun.unhandledErrors.length > 0
              }
            >
              {currentRun.unhandledErrors.length === 1
                ? 'Component tests completed with an error'
                : currentRun.unhandledErrors.length > 1
                  ? 'Component tests completed with errors'
                  : fatalError
                    ? 'Component tests didn’t complete'
                    : 'Run component tests'}
            </Title>
          )}
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
            <ToggleButton
              ariaLabel={isRunning ? 'Watch mode (cannot toggle while running)' : 'Watch mode'}
              tooltip={
                isRunning
                  ? 'Watch mode unavailable while running'
                  : `Watch mode is ${watching ? 'enabled' : 'disabled'}`
              }
              padding="small"
              size="medium"
              variant="ghost"
              pressed={watching}
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
            </ToggleButton>
          )}
          {isRunning ? (
            <Button
              // FIXME: we must clarify why isStarting has any impact here.
              // TODO: if technical reasons explain why we must wait for tests to finish
              // initialising, we'll want to have an ARIA Live region to announce when
              // the run actually starts.
              ariaLabel={cancelling ? 'Stop test run (already stopping...)' : 'Stop test run'}
              padding="none"
              size="medium"
              variant="ghost"
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
            </Button>
          ) : (
            <Button
              ariaLabel="Start test run"
              padding="small"
              size="medium"
              variant="ghost"
              onClick={() => {
                let storyIds;
                if (entry) {
                  // Don't send underlying child test ids when running on a story
                  // Vitest Manager already handles running the underlying tests
                  storyIds =
                    entry.type === 'story' ? [entry.id] : api.findAllLeafStoryIds(entry.id);
                }
                store.send({
                  type: 'TRIGGER_RUN',
                  payload: { storyIds, triggeredBy: entry?.type ?? 'global' },
                });
              }}
            >
              <PlayHollowIcon />
            </Button>
          )}
        </Actions>
      </Heading>

      <StyledActionList>
        <ActionList.Item>
          {entry ? (
            <ActionList.Text>Interactions</ActionList.Text>
          ) : (
            <ActionList.Action as="label" readOnly>
              <ActionList.Icon>
                <Form.Checkbox checked disabled />
              </ActionList.Icon>
              <ActionList.Text>Interactions</ActionList.Text>
            </ActionList.Action>
          )}
          <ActionList.Button
            ariaLabel={`${componentTestStatusLabel}${
              componentTestStatusValueToStoryIds['status-value:error'].length +
                componentTestStatusValueToStoryIds['status-value:warning'].length >
              0
                ? ` (${
                    componentTestStatusValueToStoryIds['status-value:error'].length +
                    componentTestStatusValueToStoryIds['status-value:warning'].length
                  } errors or warnings so far)`
                : ''
            }`}
            tooltip={componentTestStatusLabel}
            disabled={
              componentTestStatusValueToStoryIds['status-value:error'].length === 0 &&
              componentTestStatusValueToStoryIds['status-value:warning'].length === 0 &&
              componentTestStatusValueToStoryIds['status-value:success'].length === 0
            }
            onClick={() => {
              openPanel({
                api,
                panelId: COMPONENT_TESTING_PANEL_ID,
                entryId:
                  componentTestStatusValueToStoryIds['status-value:error'][0] ??
                  componentTestStatusValueToStoryIds['status-value:warning'][0] ??
                  componentTestStatusValueToStoryIds['status-value:success'][0] ??
                  entry?.id,
              });
            }}
          >
            <TestStatusIcon status={componentTestStatusIcon} isRunning={isRunning} />
            {componentTestStatusValueToStoryIds['status-value:error'].length +
              componentTestStatusValueToStoryIds['status-value:warning'].length || null}
          </ActionList.Button>
        </ActionList.Item>

        {!entry && (
          <ActionList.Item>
            <ActionList.Action as="label" readOnly={isRunning}>
              <ActionList.Icon>
                <Form.Checkbox
                  checked={config.coverage}
                  disabled={isRunning}
                  onChange={() =>
                    setStoreState((s) => ({
                      ...s,
                      config: { ...s.config, coverage: !config.coverage },
                    }))
                  }
                />
              </ActionList.Icon>
              <ActionList.Text>
                {watching ? <Muted>Coverage (unavailable)</Muted> : 'Coverage'}
              </ActionList.Text>
            </ActionList.Action>
            {watching ||
            (currentRun.triggeredBy && !FULL_RUN_TRIGGERS.includes(currentRun.triggeredBy)) ? (
              <ActionList.Button
                disabled
                ariaLabel={
                  watching
                    ? `Coverage unavailable in watch mode`
                    : `Coverage only available after running all tests`
                }
              >
                <InfoIcon />
              </ActionList.Button>
            ) : currentRun.coverageSummary ? (
              <ActionList.Button
                asChild
                ariaLabel={
                  isRunning
                    ? 'Open coverage report (testing still in progress)'
                    : `Open coverage report (${currentRun.coverageSummary.percentage}% coverage)`
                }
              >
                <a href="/coverage/index.html" target="_blank">
                  <TestStatusIcon
                    isRunning={isRunning}
                    percentage={currentRun.coverageSummary.percentage}
                    status={currentRun.coverageSummary.status}
                  />
                  {currentRun.coverageSummary.percentage}%
                </a>
              </ActionList.Button>
            ) : (
              <ActionList.Button
                disabled
                ariaLabel={
                  isRunning
                    ? 'Coverage unavailable, testing still in progress'
                    : fatalError
                      ? 'Coverage unavailable, component tests crashed'
                      : 'Coverage unavailable, run tests first'
                }
              >
                <TestStatusIcon
                  isRunning={isRunning}
                  status={fatalError ? 'critical' : 'unknown'}
                />
              </ActionList.Button>
            )}
          </ActionList.Item>
        )}

        {hasA11yAddon && (
          <ActionList.Item>
            {entry ? (
              <ActionList.Text>Accessibility</ActionList.Text>
            ) : (
              <ActionList.Action as="label" readOnly={isRunning}>
                <ActionList.Icon>
                  <Form.Checkbox
                    checked={config.a11y}
                    disabled={isRunning}
                    onChange={() =>
                      setStoreState((s) => ({
                        ...s,
                        config: { ...s.config, a11y: !config.a11y },
                      }))
                    }
                  />
                </ActionList.Icon>
                <ActionList.Text>Accessibility</ActionList.Text>
              </ActionList.Action>
            )}
            <ActionList.Button
              ariaLabel={a11yStatusLabel}
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
              <TestStatusIcon status={a11yStatusIcon} isRunning={isRunning} />
              {a11yStatusValueToStoryIds['status-value:error'].length +
                a11yStatusValueToStoryIds['status-value:warning'].length || null}
            </ActionList.Button>
          </ActionList.Item>
        )}
      </StyledActionList>
    </Container>
  );
};
