import React, { useState } from 'react';

import { type Addon_TestProviderType, Addon_TypesEnum } from 'storybook/internal/types';

import {
  a11yStatusStore,
  componentTestStatusStore,
  store,
  testProviderStore,
} from '#manager-store';
import { addons } from 'storybook/manager-api';

import { GlobalErrorContext, GlobalErrorModal } from './components/GlobalErrorModal';
import { SidebarContextMenu } from './components/SidebarContextMenu';
import { TestProviderRender } from './components/TestProviderRender';
import { A11Y_PANEL_ID, ADDON_ID, PANEL_ID, TEST_PROVIDER_ID } from './constants';
import { useTestProvider } from './use-test-provider-state';

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
    testProviderStore.onRunAll(() => {
      store.send({
        type: 'TRIGGER_RUN',
        payload: {
          triggeredBy: 'run-all',
        },
      });
    });
    store.untilReady().then(() => {
      store.setState((state) => ({
        ...state,
        indexUrl: new URL('index.json', window.location.href).toString(),
      }));
    });

    addons.add(TEST_PROVIDER_ID, {
      type: Addon_TypesEnum.experimental_TEST_PROVIDER,
      render: () => {
        const [isModalOpen, setModalOpen] = useState(false);
        const {
          storeState,
          setStoreState,
          testProviderState,
          componentTestStatusValueToStoryIds,
          a11yStatusValueToStoryIds,
          isSettingsUpdated,
        } = useTestProvider(api);
        return (
          <GlobalErrorContext.Provider value={{ isModalOpen, setModalOpen }}>
            <TestProviderRender
              api={api}
              storeState={storeState}
              setStoreState={setStoreState}
              isSettingsUpdated={isSettingsUpdated}
              testProviderState={testProviderState}
              componentTestStatusValueToStoryIds={componentTestStatusValueToStoryIds}
              a11yStatusValueToStoryIds={a11yStatusValueToStoryIds}
            />
            <GlobalErrorModal
              storeState={storeState}
              onRerun={() => {
                setModalOpen(false);
                store.send({
                  type: 'TRIGGER_RUN',
                  payload: {
                    triggeredBy: 'global',
                  },
                });
              }}
            />
          </GlobalErrorContext.Provider>
        );
      },

      sidebarContextMenu: ({ context }) => {
        if (context.type === 'docs') {
          return null;
        }
        if (context.type === 'story' && !context.tags.includes('test')) {
          return null;
        }
        return <SidebarContextMenu context={context} api={api} />;
      },
    });
  }
});
