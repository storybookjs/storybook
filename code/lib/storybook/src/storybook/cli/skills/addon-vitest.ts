import type { Options } from '@storybook/core/internal/types';

import { hasAddon } from './has-addon.ts';

export async function isAddonVitestEnabled(options: Options): Promise<boolean> {
  return hasAddon(options, '@storybook/addon-vitest');
}
