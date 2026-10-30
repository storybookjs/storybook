import '../../storybook/server/hooks.ts';

import { findProjectRoot } from '@storybook/core/internal/common';
import { defineAddon } from '@storybook/core/internal/deep/instance/addons';

import { featureEntry } from '../entries.ts';
import type { ControlsTypes } from './preview.ts';
import { initializeSaveStory } from './save-story/save-story.ts';

/** The controls panel and the server handlers that save or create stories from its args. */
export default defineAddon<void, ControlsTypes>(() => ({
  meta: { name: 'storybook/controls', order: 6 },
  manager: featureEntry('controls', 'manager'),
  setup(storybook): void {
    storybook.hook('server:channel:ready', (channel) => {
      initializeSaveStory(channel, {
        workingDir: storybook.workingDir,
        projectRoot: findProjectRoot(storybook.workingDir),
      });
    });
  },
}));
