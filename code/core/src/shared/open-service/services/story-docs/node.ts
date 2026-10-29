import { defineAddon } from '../../../../instance/plugins.ts';
import type { Storybook } from '../../../../instance/types.ts';

import setup from '#story-docs-addon-setup';

// Typed against the browser's empty stand-in, which takes no argument.
const setupService: (storybook: Storybook) => void | Promise<void> = setup;

/** Options the product passes when composing the story-docs addon. */
export interface StoryDocsAddonOptions {
  /** Absolute path of the preview annotations the host's builder imports. */
  preview?: string;
}

export default defineAddon((options: StoryDocsAddonOptions | void) => ({
  meta: { name: 'storybook/story-docs' },
  async setup(storybook): Promise<void> {
    const preview = options?.preview;
    if (preview) {
      storybook.hook('preview:annotations:collect', () => [preview]);
    }
    await setupService(storybook);
  },
}));
