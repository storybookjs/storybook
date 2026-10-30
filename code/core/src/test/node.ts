import { defineAddon } from '../instance/addons.ts';

import type { TestTypes } from './preview.ts';

/** Options the product passes when composing the test addon. */
export interface TestAddonOptions {
  /** Absolute path of the preview annotations the host's builder imports. */
  preview?: string;
}

export default defineAddon<TestAddonOptions | void, TestTypes>((options) => ({
  meta: { name: 'storybook/test' },
  setup(storybook): void {
    const preview = options?.preview;
    if (preview) {
      storybook.hook('preview:annotations:collect', () => [preview]);
    }
  },
}));
