import { defineAddon } from '../../instance/plugins.ts';

/** Options the product passes when composing the ghost-stories addon. */
export interface GhostStoriesAddonOptions {
  /** Absolute path of the preview annotations the host's builder imports. */
  preview?: string;
}

export default defineAddon((options: GhostStoriesAddonOptions | void) => ({
  meta: { name: 'storybook/ghost-stories' },
  setup(storybook): void {
    const preview = options?.preview;
    if (preview) {
      storybook.hook('preview:annotations:collect', () => [preview]);
    }
  },
}));
