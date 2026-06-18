import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { registerService, useServiceCommand, useServiceQuery } from 'storybook/manager-api';
import type { ServiceInstanceOf } from 'storybook/open-service';
import { localCommandSyncServiceDef } from './definition.ts';

const ADDON_ID = 'storybook/internal/open-service-local-command-sync-demo';

type LocalCommandSyncService = ServiceInstanceOf<typeof localCommandSyncServiceDef>;

function LocalCommandSyncTool({ service }: { service: LocalCommandSyncService }) {
  const value = useServiceQuery(service, 'getValue');
  const setValue = useServiceCommand(service, 'setValue');
  return (
    <label style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
      <input
        aria-label="Local command toolbar sync input"
        type="text"
        value={value}
        placeholder="Local command"
        onChange={(event) => {
          void setValue({ value: event.currentTarget.value });
        }}
        style={{ width: 120 }}
      />
    </label>
  );
}

addons.register(ADDON_ID, () => {
  const service = registerService(localCommandSyncServiceDef);

  addons.add(ADDON_ID, {
    title: 'Open service local command sync',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!viewMode?.match(/^(story|docs)$/) && !tabId,
    render: () => <LocalCommandSyncTool service={service} />,
  });
});
