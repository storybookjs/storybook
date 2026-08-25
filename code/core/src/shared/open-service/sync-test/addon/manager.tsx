import React from 'react';

import { AddonPanel } from 'storybook/internal/components';

import { addons, registerService, types } from 'storybook/manager-api';
import { localCommandSyncServiceDef } from '../local-command/definition.ts';
import { remoteCommandSyncServiceDef } from '../remote-command/definition.ts';
import { staticLoadSyncServiceDef } from '../static-load/definition.ts';
import {
  OPEN_SERVICE_DEMO_ADDON_ID,
  OPEN_SERVICE_DEMO_PANEL_ID,
  OPEN_SERVICE_DEMO_PARAM_KEY,
  type OpenServiceDemoParameters,
} from './constants.ts';
import { OpenServiceDemoPanel } from './panels/OpenServiceDemoPanel.tsx';
import type { OpenServiceDemoServices } from './services.ts';

function isOpenServiceDemoDisabled(parameters: Record<string, unknown> | undefined): boolean {
  const config = parameters?.[OPEN_SERVICE_DEMO_PARAM_KEY] as OpenServiceDemoParameters | undefined;
  return !config?.enabled;
}

addons.register(OPEN_SERVICE_DEMO_ADDON_ID, () => {
  const services: OpenServiceDemoServices = {
    localCommand: registerService(localCommandSyncServiceDef),
    remoteCommand: registerService(remoteCommandSyncServiceDef),
    staticLoad: registerService(staticLoadSyncServiceDef),
  };

  addons.add(OPEN_SERVICE_DEMO_PANEL_ID, {
    title: 'Open Service',
    type: types.PANEL,
    paramKey: OPEN_SERVICE_DEMO_PARAM_KEY,
    match: ({ viewMode, tabId }) => !!viewMode?.match(/^(story|docs)$/) && !tabId,
    disabled: isOpenServiceDemoDisabled,
    render: ({ active }) => {
      if (!active) {
        return null;
      }

      return (
        <AddonPanel active={active}>
          <OpenServiceDemoPanel services={services} />
        </AddonPanel>
      );
    },
  });
});
