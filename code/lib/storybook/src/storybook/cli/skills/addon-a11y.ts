import type { Options } from '@storybook/core/internal/types';

import { hasAddon } from './has-addon.ts';

export async function isAddonA11yEnabled(options: Options): Promise<boolean> {
  return hasAddon(options, '@storybook/addon-a11y');
}
