import '../../storybook/server/hooks.ts';

import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import { initOpenInEditorChannel } from './open-in-editor-channel.ts';

/** Open files the manager asks for in the user's editor. */
export default defineAddon(() => ({
  meta: { name: 'storybook/open-in-editor' },
  setup(storybook): void {
    storybook.hook('server:channel:ready', (channel) => {
      void initOpenInEditorChannel(channel);
    });
  },
}));
