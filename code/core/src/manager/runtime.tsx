import React from 'react';

import type { Channel } from 'storybook/internal/channels';
import { createBrowserChannel } from 'storybook/internal/channels';
import { CHANNEL_CREATED, CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events';
import type { Addon_Config, Addon_Types } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { FailedIcon } from '@storybook/icons';

import type { API, AddonStore } from 'storybook/manager-api';
import { addons, types } from 'storybook/manager-api';
import { color } from 'storybook/theming';

import { ToolbarManager } from '../toolbar/components/ToolbarManager.tsx';
import { TOOLBAR_ID } from '../toolbar/constants.ts';
import { renderStorybookUI } from './index.tsx';
import Provider from './provider.ts';

const WS_DISCONNECTED_NOTIFICATION_ID = 'CORE/WS_DISCONNECTED';

// Register the toolbar in the manager
addons.register(TOOLBAR_ID, () =>
  addons.add(TOOLBAR_ID, {
    title: TOOLBAR_ID,
    type: types.TOOL,
    match: ({ tabId }) => !tabId,
    render: () => <ToolbarManager />,
  })
);

// Install the manager channel at module load, before the deferred render below and before any
// manager entry can read it. This guarantees `addons.getChannel()` returns the real channel in the
// manager runtime instead of falling back to a throwaway mock.
const channel = createBrowserChannel({ page: 'manager' });
addons.setChannel(channel);
channel.emit(CHANNEL_CREATED);

class ReactProvider extends Provider {
  addons: AddonStore = addons;

  channel: Channel = channel;

  wsDisconnected = false;

  getElements(type: Addon_Types) {
    return this.addons.getElements(type);
  }

  getConfig(): Addon_Config {
    return this.addons.getConfig();
  }

  handleAPI(api: API) {
    this.addons.loadAddons(api);

    this.channel.on(CHANNEL_WS_DISCONNECT, (ev) => {
      const TIMEOUT_CODE = 3008;
      this.wsDisconnected = true;

      api.addNotification({
        id: WS_DISCONNECTED_NOTIFICATION_ID,
        content: {
          headline: ev.code === TIMEOUT_CODE ? 'Server timed out' : 'Connection lost',
          subHeadline: 'Please restart your Storybook server and reload the page',
        },
        icon: <FailedIcon color={color.negative} />,
        link: undefined,
      });
    });
  }
}

const { document } = global;
const rootEl = document.getElementById('root');

// We need to wait for the script tag containing the global objects
// to be run by Webkit before rendering the UI. This is fine in most browsers.
setTimeout(() => {
  // @ts-expect-error (non strict)
  renderStorybookUI(rootEl, new ReactProvider());
}, 0);
