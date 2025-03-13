import React, { useState } from 'react';

import { AddonPanel } from 'storybook/internal/components';
import type { StatusValue } from 'storybook/internal/types';
import { type Addon_TestProviderType, Addon_TypesEnum } from 'storybook/internal/types';

import { a11yStatusStore, componentTestStatusStore, store } from '#manager-store';
import type { Combo } from 'storybook/manager-api';
import { Consumer, addons, types } from 'storybook/manager-api';

import { GlobalErrorContext, GlobalErrorModal } from './components/GlobalErrorModal';
import { Panel } from './components/Panel';
import { PanelTitle } from './components/PanelTitle';
import { TestProviderRender } from './components/TestProviderRender';
import {
  A11Y_PANEL_ID,
  ADDON_ID,
  type Details,
  PANEL_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  TEST_PROVIDER_ID,
} from './constants';
import type { TestStatus } from './node/reporter';

const statusMap: Record<TestStatus, StatusValue> = {
  pending: 'status-value:pending',
  passed: 'status-value:success',
  warning: 'status-value:warn',
  failed: 'status-value:error',
  skipped: 'status-value:unknown',
};

addons.register(ADDON_ID, (api) => {
  const storybookBuilder = (globalThis as any).STORYBOOK_BUILDER || '';
  if (storybookBuilder.includes('vite')) {
    const openPanel = (panelId: string) => {
      api.setSelectedPanel(panelId);
      api.togglePanel(true);
    };
    componentTestStatusStore.onSelect(() => {
      openPanel(PANEL_ID);
    });
    a11yStatusStore.onSelect(() => {
      openPanel(A11Y_PANEL_ID);
    });

    addons.add(TEST_PROVIDER_ID, {
      type: Addon_TypesEnum.experimental_TEST_PROVIDER,
      runnable: true,
      name: 'Component tests',
      // @ts-expect-error: TODO: Fix types
      render: (state) => {
        const [isModalOpen, setModalOpen] = useState(false);
        return (
          <GlobalErrorContext.Provider
            value={{ error: state.error?.message, isModalOpen, setModalOpen }}
          >
            <TestProviderRender api={api} state={state} />
            <GlobalErrorModal
              onRerun={() => {
                setModalOpen(false);
                api.runTestProvider(TEST_PROVIDER_ID);
              }}
            />
          </GlobalErrorContext.Provider>
        );
      },

      // @ts-expect-error: TODO: Fix types
      sidebarContextMenu: ({ context, state }) => {
        if (context.type === 'docs') {
          return null;
        }
        if (context.type === 'story' && !context.tags.includes('test')) {
          return null;
        }
        return (
          <TestProviderRender
            api={api}
            state={state}
            entryId={context.id}
            style={{ minWidth: 240 }}
          />
        );
      },

      // @ts-expect-error: TODO: Fix types
      stateUpdater: (state, update) => {
        const updated = {
          ...state,
          ...update,
          details: { ...state.details, ...update.details },
        };

        if ((!state.running && update.running) || store.getState().watching) {
          // Clear coverage data when starting test run or enabling watch mode
          delete updated.details.coverageSummary;
        }

        if (update.details?.testResults) {
          componentTestStatusStore.set(
            update.details.testResults.flatMap((testResult) =>
              testResult.results
                .filter(({ storyId }) => storyId)
                .map(({ storyId, status, testRunId, ...rest }) => {
                  return {
                    storyId,
                    typeId: STATUS_TYPE_ID_COMPONENT_TEST,
                    value: statusMap[status],
                    title: 'Component tests',
                    description:
                      'failureMessages' in rest && rest.failureMessages
                        ? rest.failureMessages.join('\n')
                        : '',
                    data: { testRunId },
                    sidebarContextMenu: false,
                  };
                })
            )
          );
          a11yStatusStore.set(
            update.details.testResults.flatMap((testResult) =>
              testResult.results
                .filter(({ storyId, reports }) => {
                  const a11yReport = reports.find((r: any) => r.type === 'a11y');
                  return storyId && a11yReport;
                })
                .map(({ storyId, testRunId, reports }) => {
                  const a11yReport = reports.find((r: any) => r.type === 'a11y')!;
                  return {
                    storyId,
                    typeId: STATUS_TYPE_ID_A11Y,
                    value: statusMap[a11yReport.status],
                    title: 'Accessibility tests',
                    description: '',
                    data: { testRunId },
                    sidebarContextMenu: false,
                  };
                })
            )
          );
        }

        return updated;
      },
    } satisfies Omit<Addon_TestProviderType<Details>, 'id'>);
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
        <AddonPanel active={!!active}>
          <Consumer filter={filter}>{({ storyId }) => <Panel storyId={storyId} />}</Consumer>
        </AddonPanel>
      );
    },
  });
});
