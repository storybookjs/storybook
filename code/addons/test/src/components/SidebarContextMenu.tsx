import type { FC } from 'react';
import React from 'react';

import { type API } from 'storybook/internal/manager-api';
import type { Addon_TestProviderType } from 'storybook/internal/types';

import { type Details } from '../constants';
import { useTestProvider } from '../use-test-provider-state';
import { TestProviderRender } from './TestProviderRender';

type SidebarContextMenuProps = {
  api: API;
} & Parameters<NonNullable<Addon_TestProviderType<Details>['sidebarContextMenu']>>[0];

export const SidebarContextMenu: FC<SidebarContextMenuProps> = ({ context, state, api }) => {
  const {
    testProviderState,
    componentTestStatusCountsByValue,
    a11yStatusCountsByValue,
    storeState,
    setStoreState,
  } = useTestProvider(api, context.id);

  return (
    <TestProviderRender
      api={api}
      state={state}
      entryId={context.id}
      style={{ minWidth: 240 }}
      testProviderState={testProviderState}
      componentTestStatusCountsByValue={componentTestStatusCountsByValue}
      a11yStatusCountsByValue={a11yStatusCountsByValue}
      storeState={storeState}
      setStoreState={setStoreState}
    />
  );
};
