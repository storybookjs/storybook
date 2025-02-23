import React from 'react';

import type { Channel } from '@storybook/core/channels';
import { createBrowserChannel } from '@storybook/core/channels';
import type { Addon_Config, Addon_Types } from '@storybook/core/types';
import { global } from '@storybook/global';
import { FailedIcon } from '@storybook/icons';
import { color } from '@storybook/theming';

import { CHANNEL_CREATED, CHANNEL_WS_DISCONNECT } from '@storybook/core/core-events';
import type { API, AddonStore } from '@storybook/core/manager-api';
import { addons } from '@storybook/core/manager-api';

import { renderStorybookUI } from './index';
import Provider from './provider';

const WS_DISCONNECTED_NOTIFICATION_ID = 'CORE/WS_DISCONNECTED';

class ReactProvider extends Provider {
  addons: AddonStore;

  channel: Channel;

  wsDisconnected = false;

  constructor() {
    super();

    const channel = createBrowserChannel({ page: 'manager' });

    addons.setChannel(channel);

    channel.emit(CHANNEL_CREATED);

    this.addons = addons;
    this.channel = channel;
    global.__STORYBOOK_ADDONS_CHANNEL__ = channel;
  }

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
