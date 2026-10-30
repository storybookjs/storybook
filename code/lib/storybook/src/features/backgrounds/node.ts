import { defineAddon } from '@storybook/core/internal/deep/instance/addons';

import { featureEntry } from '../entries.ts';
import type { BackgroundTypes } from './preview.ts';

export default defineAddon<void, BackgroundTypes>(() => ({
  meta: { name: 'storybook/backgrounds', order: 4 },
  manager: featureEntry('backgrounds', 'manager'),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [featureEntry('backgrounds', 'preview')]);
  },
}));
