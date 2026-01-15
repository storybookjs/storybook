import type { FC } from 'react';
import React from 'react';

import type { API_HashEntry } from 'storybook/internal/types';

import { addons } from 'storybook/manager-api';
import { type API } from 'storybook/manager-api';

import { TRIGGER_TEST_RUN_REQUEST, TRIGGER_TEST_RUN_RESPONSE } from '../constants';
import type { TriggerTestRunResponsePayload } from '../constants';
import { useTestProvider } from '../use-test-provider-state';
import { TestProviderRender } from './TestProviderRender';

type SidebarContextMenuProps = {
  api: API;
  context: API_HashEntry;
};

export const SidebarContextMenu: FC<SidebarContextMenuProps> = ({ context, api }) => {
  const {
    testProviderState,
    componentTestStatusValueToStoryIds,
    a11yStatusValueToStoryIds,
    storeState,
    setStoreState,
  } = useTestProvider(api, context.id);

  const handleTestTrigger = () => {
    const channel = addons.getChannel();
    const requestId = `test-${Date.now()}`;

    const handleResponse = (payload: TriggerTestRunResponsePayload) => {
      if (payload.requestId === requestId) {
        channel.off(TRIGGER_TEST_RUN_RESPONSE, handleResponse);
        console.log('Test run response:', payload);
        alert(`Test run ${payload.status}!`);
      }
    };

    channel.on(TRIGGER_TEST_RUN_RESPONSE, handleResponse);
    channel.emit(TRIGGER_TEST_RUN_REQUEST, {
      requestId,
      actor: 'sidebar-test-button',
      storyIds: context.type === 'story' ? [context.id] : undefined,
    });
  };

  return (
    <>
      <button onClick={handleTestTrigger} style={{ margin: 8 }}>
        Test Channel Trigger API
      </button>
      <TestProviderRender
        api={api}
        entry={context}
        style={{ minWidth: 240 }}
        testProviderState={testProviderState}
        componentTestStatusValueToStoryIds={componentTestStatusValueToStoryIds}
        a11yStatusValueToStoryIds={a11yStatusValueToStoryIds}
        storeState={storeState}
        setStoreState={setStoreState}
        isSettingsUpdated={false}
      />
    </>
  );
};
