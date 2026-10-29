import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import { featureEntry } from '../entries.ts';
import type { OutlineTypes } from './preview.ts';

export default defineAddon<void, OutlineTypes>(() => ({
  meta: { name: 'storybook/outline', order: 8 },
  manager: featureEntry('outline', 'manager'),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [featureEntry('outline', 'preview')]);
  },
}));
