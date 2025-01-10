import type { Channel } from '@storybook/core/channels';
import { createBrowserChannel } from '@storybook/core/channels';
import type { Addon_Config, Addon_Types } from '@storybook/core/types';
import { global } from '@storybook/global';

import { CHANNEL_CREATED } from '@storybook/core/core-events';
import type { AddonStore } from '@storybook/core/manager-api';
import { addons } from '@storybook/core/manager-api';

import { renderStorybookUI } from './index';
import Provider from './provider';

class ReactProvider extends Provider {
  addons: AddonStore;

  channel: Channel;

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

  handleAPI(api: unknown) {
    this.addons.loadAddons(api);
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
