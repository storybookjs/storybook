import type { FC } from 'react';
import React from 'react';

import type { API_HashEntry } from 'storybook/internal/types';

import { type API } from 'storybook/manager-api';

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

  return (
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
  );
};
