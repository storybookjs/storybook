import { defineAddon } from '../../../../instance/plugins.ts';
import type { Storybook } from '../../../../instance/types.ts';

import setup from '#docgen-addon-setup';

// Typed against the browser's empty stand-in, which takes no argument.
const setupService: (storybook: Storybook) => void | Promise<void> = setup;

/** Options the product passes when composing the docgen addon. */
export interface DocgenAddonOptions {
  /** Absolute path of the manager entry the host bundles. */
  manager?: string;
  /** Absolute path of the preview annotations the host's builder imports. */
  preview?: string;
}

export default defineAddon((options: DocgenAddonOptions | void) => ({
  meta: { name: 'storybook/docgen', order: 0 },
  manager: options?.manager,
  async setup(storybook): Promise<void> {
    const preview = options?.preview;
    if (preview) {
      storybook.hook('preview:annotations:collect', () => [preview]);
    }
    await setupService(storybook);
  },
}));
