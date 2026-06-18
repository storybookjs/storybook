import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { registerService, useServiceCommand, useServiceQuery } from 'storybook/manager-api';
import type { ServiceInstanceOf } from 'storybook/open-service';
import { remoteCommandSyncServiceDef } from './definition.ts';

const ADDON_ID = 'storybook/internal/open-service-remote-command-sync-demo';

type RemoteCommandSyncService = ServiceInstanceOf<typeof remoteCommandSyncServiceDef>;

function RemoteCommandSyncTool({ service }: { service: RemoteCommandSyncService }) {
  const value = useServiceQuery(service, 'getValue');
  const setValue = useServiceCommand(service, 'setValue');
  return (
    <label style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
      <input
        aria-label="Remote command toolbar sync input"
        type="text"
        value={value}
        placeholder="Remote command"
        onChange={(event) => {
          void setValue({ value: event.currentTarget.value });
        }}
        style={{ width: 120 }}
      />
    </label>
  );
}

addons.register(ADDON_ID, () => {
  const service = registerService(remoteCommandSyncServiceDef);

  addons.add(ADDON_ID, {
    title: 'Open service remote command sync',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!viewMode?.match(/^(story|docs)$/) && !tabId,
    render: () => <RemoteCommandSyncTool service={service} />,
  });
});
