import { defineAddon } from '../../../../instance/plugins.ts';

import setup from '#docgen-addon-setup';

/** Options the product passes when composing the docgen addon. */
export interface DocgenAddonOptions {
  /** Manager entry (product-relative path or package specifier) the product attaches. */
  manager?: string;
}

export default defineAddon((options: DocgenAddonOptions | void) => ({
  meta: { name: 'storybook/docgen', order: 0 },
  manager: options?.manager,
  setup,
}));
