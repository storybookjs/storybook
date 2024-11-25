import React, { useState } from 'react';

import { AddonPanel, Button, Link as LinkComponent } from 'storybook/internal/components';
import type { Combo } from 'storybook/internal/manager-api';
import { Consumer, addons, types } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';
import {
  type API_StatusObject,
  type API_StatusValue,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import { EyeIcon, PlayHollowIcon, StopAltHollowIcon } from '@storybook/icons';

import { ContextMenuItem } from './components/ContextMenuItem';
import { GlobalErrorModal } from './components/GlobalErrorModal';
import { Panel } from './components/Panel';
import { PanelTitle } from './components/PanelTitle';
import { RelativeTime } from './components/RelativeTime';
import { ADDON_ID, PANEL_ID, TEST_PROVIDER_ID } from './constants';
import type { TestResult } from './node/reporter';

const statusMap: Record<any['status'], API_StatusValue> = {
  failed: 'error',
  passed: 'success',
  pending: 'pending',
};

export function getRelativeTimeString(date: Date): string {
  const delta = Math.round((date.getTime() - Date.now()) / 1000);
  const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
  const units: Intl.RelativeTimeFormatUnit[] = [
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'year',
  ];

  const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(delta));
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(Math.floor(delta / divisor), units[unitIndex]);
}

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 6,
});

const SidebarContextMenuTitle = styled.div<{ crashed?: boolean }>(({ crashed, theme }) => ({
  fontSize: theme.typography.size.s1,
  fontWeight: crashed ? 'bold' : 'normal',
  color: crashed ? theme.color.negativeText : theme.color.defaultText,
}));

const Description = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.barTextColor,
}));

const Actions = styled.div({
  display: 'flex',
  gap: 6,
});

addons.register(ADDON_ID, (api) => {
  const storybookBuilder = (globalThis as any).STORYBOOK_BUILDER || '';
  if (storybookBuilder.includes('vite')) {
    const openAddonPanel = () => {
      api.setSelectedPanel(PANEL_ID);
      api.togglePanel(true);
    };

    addons.add(TEST_PROVIDER_ID, {
      type: Addon_TypesEnum.experimental_TEST_PROVIDER,
      runnable: true,
      watchable: true,
      name: 'Component tests',

      sidebarContextMenu: ({ context, state }) => {
        if (context.type === 'docs') {
          return null;
        }
        if (context.type === 'story' && !context.tags.includes('test')) {
          return null;
        }

        return <ContextMenuItem context={context} state={state} />;
      },

      render: (state) => {
        const [isModalOpen, setIsModalOpen] = useState(false);

        const title = state.crashed || state.failed ? 'Component tests failed' : 'Component tests';
        const errorMessage = state.error?.message;
        let description: string | React.ReactNode = 'Not run';

        if (state.running) {
          description = state.progress
            ? `Testing... ${state.progress.numPassedTests}/${state.progress.numTotalTests}`
            : 'Starting...';
        } else if (state.failed && !errorMessage) {
          description = '';
        } else if (state.crashed || (state.failed && errorMessage)) {
          description = (
            <>
              <LinkComponent
                isButton
                onClick={() => {
                  setIsModalOpen(true);
                }}
              >
                {state.error?.name || 'View full error'}
              </LinkComponent>
            </>
          );
        } else if (state.progress?.finishedAt) {
          description = (
            <RelativeTime
              timestamp={new Date(state.progress.finishedAt)}
              testCount={state.progress.numTotalTests}
            />
          );
        } else if (state.watching) {
          description = 'Watching for file changes';
        }

        return (
          <>
            <Info>
              <SidebarContextMenuTitle crashed={state.crashed} id="testing-module-title">
                {title}
              </SidebarContextMenuTitle>
              <Description id="testing-module-description">{description}</Description>
            </Info>

            <Actions>
              {state.watchable && (
                <Button
                  aria-label={`${state.watching ? 'Disable' : 'Enable'} watch mode for ${state.name}`}
                  variant="ghost"
                  padding="small"
                  active={state.watching}
                  onClick={() => api.setTestProviderWatchMode(state.id, !state.watching)}
                  disabled={state.crashed || state.running}
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
                      padding="small"
                      onClick={() => api.cancelTestProvider(state.id)}
                      disabled={state.cancelling}
                    >
                      <StopAltHollowIcon />
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Start ${state.name}`}
                      variant="ghost"
                      padding="small"
                      onClick={() => api.runTestProvider(state.id)}
                      disabled={state.crashed || state.running}
                    >
                      <PlayHollowIcon />
                    </Button>
                  )}
                </>
              )}
            </Actions>

            <GlobalErrorModal
              error={errorMessage}
              open={isModalOpen}
              onClose={() => {
                setIsModalOpen(false);
              }}
              onRerun={() => {
                setIsModalOpen(false);
                api.runTestProvider(TEST_PROVIDER_ID);
              }}
            />
          </>
        );
      },

      mapStatusUpdate: (state) =>
        Object.fromEntries(
          (state.details.testResults || []).flatMap((testResult) =>
            testResult.results
              .map(({ storyId, status, testRunId, ...rest }) => {
                if (storyId) {
                  const statusObject: API_StatusObject = {
                    title: 'Component tests',
                    status: statusMap[status],
                    description:
                      'failureMessages' in rest && rest.failureMessages?.length
                        ? rest.failureMessages.join('\n')
                        : '',
                    data: {
                      testRunId,
                    },
                    onClick: openAddonPanel,
                  };
                  return [storyId, statusObject];
                }
              })
              .filter(Boolean)
          )
        ),
    } as Addon_TestProviderType<{
      testResults: TestResult[];
    }>);
  }

  const filter = ({ state }: Combo) => {
    return {
      storyId: state.storyId,
    };
  };

  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: () => <PanelTitle />,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      return (
        <AddonPanel active={active}>
          <Consumer filter={filter}>{({ storyId }) => <Panel storyId={storyId} />}</Consumer>
        </AddonPanel>
      );
    },
  });
});
