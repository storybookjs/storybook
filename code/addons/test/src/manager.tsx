import React, { useState } from 'react';

import { AddonPanel } from 'storybook/internal/components';
import type { Combo } from 'storybook/internal/manager-api';
import { Consumer, addons, types } from 'storybook/internal/manager-api';
import {
  type API_StatusObject,
  type API_StatusValue,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import { GlobalErrorContext, GlobalErrorModal } from './components/GlobalErrorModal';
import { Panel } from './components/Panel';
import { PanelTitle } from './components/PanelTitle';
import { TestProviderRender } from './components/TestProviderRender';
import { ADDON_ID, type Config, type Details, PANEL_ID, TEST_PROVIDER_ID } from './constants';
import type { TestStatus } from './node/reporter';

const statusMap: Record<TestStatus, API_StatusValue> = {
  failed: 'error',
  passed: 'success',
  pending: 'pending',
  warning: 'warn',
  skipped: 'unknown',
};

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

      mapStatusUpdate: (state) =>
        Object.fromEntries(
          (state.details?.testResults || []).flatMap((testResult) =>
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
                    sidebarContextMenu: false,
                  };
                  return [storyId, statusObject];
                }
              })
              .filter(Boolean)
          )
        ),
    } as Addon_TestProviderType<Details, Config>);
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
