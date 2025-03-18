import type { FC } from 'react';
import React from 'react';

import { type API, experimental_useStatusStore } from 'storybook/internal/manager-api';
import { experimental_useTestProviderStore } from 'storybook/internal/manager-api';
import type { Addon_TestProviderType } from 'storybook/internal/types';

import { ADDON_ID, type Details, STATUS_TYPE_ID_COMPONENT_TEST } from '../constants';
import { TestProviderRender } from './TestProviderRender';

type SidebarContextMenuProps = {
  api: API;
} & Parameters<NonNullable<Addon_TestProviderType<Details>['sidebarContextMenu']>>[0];

export const SidebarContextMenu: FC<SidebarContextMenuProps> = ({ context, state, api }) => {
  const testProviderState = experimental_useTestProviderStore((s) => s[ADDON_ID]);
  const componentTestErrorCount = experimental_useStatusStore((allStatuses) => {
    let errorCount = 0;
    Object.values(allStatuses).forEach((statusByTypeId) => {
      const componentTestStatus = statusByTypeId[STATUS_TYPE_ID_COMPONENT_TEST];
      if (!componentTestStatus) {
        return;
      }
      if (componentTestStatus.value === 'status-value:error') {
        errorCount++;
      }
    });

    return errorCount;
  });

  return (
    <TestProviderRender
      api={api}
      state={state}
      entryId={context.id}
      style={{ minWidth: 240 }}
      testProviderState={testProviderState}
      componentTestErrorCount={componentTestErrorCount}
    />
  );
};
