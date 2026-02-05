import type { Channel } from 'storybook/internal/channels';
import { CHANNEL_CREATED, CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events';
import { MemoryRouter } from 'storybook/internal/router';
import type { Addon_Config, Addon_Types } from 'storybook/internal/types';
import type { API_PreparedStoryIndex } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { FailedIcon } from '@storybook/icons';

import { HelmetProvider } from 'react-helmet-async';
import type { API, AddonStore } from 'storybook/manager-api';
import { addons, mockChannel } from 'storybook/manager-api';
import { screen, within } from 'storybook/test';
import { color } from 'storybook/theming';

import preview from '../../../.storybook/preview';
import { Main } from './index';
import Provider from './provider';

const WS_DISCONNECTED_NOTIFICATION_ID = 'CORE/WS_DISCONNECTED';

const channel = mockChannel() as unknown as Channel;

const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalClear = Storage.prototype.clear;

const mockStoryIndex: API_PreparedStoryIndex = {
  v: 5,
  entries: {
    'example-button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      title: 'Example/Button',
      name: 'Primary',
      importPath: './example-button.stories.tsx',
      parameters: {},
    },
  },
};

class ReactProvider extends Provider {
  addons: AddonStore;

  channel: Channel;

  wsDisconnected = false;

  constructor() {
    super();

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

    // Initialize story index with mock data
    api.setIndex(mockStoryIndex).then(() => {
      // Mark preview as initialized so the iframe doesn't show a spinner
      api.setPreviewInitialized();

      // Set the current story to example-button--primary after the index is initialized
      // This navigates to the story URL, which will cause the iframe to load the correct story
      api.selectStory('example-button--primary', undefined, { viewMode: 'story' });
    });

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

const meta = preview.meta({
  title: 'Main',
  component: Main,
  args: {
    provider: new ReactProvider(),
  },
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      disableSnapshot: true,
    },
  },
  beforeEach: () => {
    global.PREVIEW_URL = 'about:blank';

    Storage.prototype.getItem = () => null;
    Storage.prototype.setItem = () => {};
    Storage.prototype.clear = () => {};
  },
  afterEach: () => {
    Storage.prototype.getItem = originalGetItem;
    Storage.prototype.setItem = originalSetItem;
    Storage.prototype.clear = originalClear;
  },
  decorators: [
    (Story) => (
      <HelmetProvider key="helmet.Provider">
        <MemoryRouter key="location.provider">
          <Story />
        </MemoryRouter>
      </HelmetProvider>
    ),
  ],
});

export default meta;

export const Default = meta.story({});

export const ToggleSidebar = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByLabelText('Settings'));
    await userEvent.click(await screen.findByRole('button', { name: /Show sidebar/i }));
  },
});

export const ToggleToolbar = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByLabelText('Settings'));
    await userEvent.click(await screen.findByRole('button', { name: /Show toolbar/i }));
  },
});

export const TogglePanel = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByLabelText('Settings'));
    await userEvent.click(await screen.findByRole('button', { name: /Show addons panel/i }));
  },
});

export const RightPanel = meta.story({
  play: async ({ canvasElement, userEvent }) => {
    const panel = within(canvasElement.querySelector('#storybook-panel-root') as HTMLElement);
    await userEvent.click(await panel.findByLabelText('Move addon panel to right'));
  },
});

export const FullScreen = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Enter full screen/i }));
  },
});

export const ConnectionLost = meta.story({
  play: async () => {
    channel.emit(CHANNEL_WS_DISCONNECT, { code: 3007 });
  },
});

export const ServerTimedOut = meta.story({
  play: async () => {
    channel.emit(CHANNEL_WS_DISCONNECT, { code: 3008 });
  },
});

export const AboutPage = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByLabelText('Settings'));
    await userEvent.click(await screen.findByRole('link', { name: /About your Storybook/i }));
  },
});

export const GuidePage = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByLabelText('Settings'));
    await userEvent.click(await screen.findByRole('link', { name: /Onboarding guide/i }));
  },
});

export const ShortcutsPage = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByLabelText('Settings'));
    await userEvent.click(await screen.findByRole('link', { name: /Keyboard shortcuts/i }));
  },
});
