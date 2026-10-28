import React from 'react';

import { AddonPanel } from '@storybook/ui/internal/components';

import { addons, registerService, types } from '@storybook/manager/manager-api';

import { concurrentWritesSyncServiceDef } from '@storybook/core/internal/deep/shared/open-service/sync-test/concurrent-writes/definition';
import { localCommandSyncServiceDef } from '@storybook/core/internal/deep/shared/open-service/sync-test/local-command/definition';
import { remoteCommandSyncServiceDef } from '@storybook/core/internal/deep/shared/open-service/sync-test/remote-command/definition';
import { staticLoadSyncServiceDef } from '@storybook/core/internal/deep/shared/open-service/sync-test/static-load/definition';
import {
  OPEN_SERVICE_DEMO_ADDON_ID,
  OPEN_SERVICE_DEMO_PANEL_ID,
  OPEN_SERVICE_DEMO_PARAM_KEY,
  type OpenServiceDemoParameters,
} from '@storybook/core/internal/deep/shared/open-service/sync-test/addon/constants';
import { OpenServiceDemoPanel } from './panels/OpenServiceDemoPanel.tsx';
import type { OpenServiceDemoServices } from '@storybook/core/internal/deep/shared/open-service/sync-test/addon/services';

function isOpenServiceDemoDisabled(parameters: Record<string, unknown> | undefined): boolean {
  const config = parameters?.[OPEN_SERVICE_DEMO_PARAM_KEY] as OpenServiceDemoParameters | undefined;
  return !config?.enabled;
}

addons.register(OPEN_SERVICE_DEMO_ADDON_ID, () => {
  const services: OpenServiceDemoServices = {
    localCommand: registerService(localCommandSyncServiceDef),
    remoteCommand: registerService(remoteCommandSyncServiceDef),
    staticLoad: registerService(staticLoadSyncServiceDef),
    concurrentWrites: registerService(concurrentWritesSyncServiceDef),
  };

  addons.add(OPEN_SERVICE_DEMO_PANEL_ID, {
    title: 'Open Service',
    type: types.PANEL,
    paramKey: OPEN_SERVICE_DEMO_PARAM_KEY,
    match: ({ viewMode }) => !!viewMode?.match(/^(story|docs)$/),
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
