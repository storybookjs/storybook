import '../../storybook/server/hooks.ts';

import { defineAddon } from '@storybook/core/internal/deep/instance/addons';

import { createChecklistServerStore, initializeChecklist } from './checklist.ts';

/** Own the onboarding checklist store the sidebar and settings render. */
export default defineAddon(() => ({
  meta: { name: 'storybook/checklist' },
  setup(storybook): void {
    // An attached instance mirrors the dev server, which owns the store.
    if (storybook.attached) {
      return;
    }
    const store = createChecklistServerStore(storybook.channel);
    storybook.hook('core:instance:close', () => store.__dispose());
    storybook.hook('server:channel:ready', (channel) => {
      void initializeChecklist(
        store,
        channel,
        () => storybook.getStoryIndexGenerator(),
        storybook.configDir
      );
    });
  },
}));
