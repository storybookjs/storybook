import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import { featureEntry } from '../entries.ts';
import type { ViewportTypes } from './preview.ts';

export default defineAddon<void, ViewportTypes>(() => ({
  meta: { name: 'storybook/viewport', order: 7 },
  manager: featureEntry('viewport', 'manager'),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [featureEntry('viewport', 'preview')]);
  },
}));
