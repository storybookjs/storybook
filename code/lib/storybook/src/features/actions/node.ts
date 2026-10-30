import { defineAddon } from '@storybook/core/internal/deep/instance/addons';

import { featureEntry } from '../entries.ts';
import type { ActionsTypes } from './preview.ts';

export default defineAddon<void, ActionsTypes>(() => ({
  meta: { name: 'storybook/actions', order: 3 },
  manager: featureEntry('actions', 'manager'),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [featureEntry('actions', 'preview')]);
  },
}));
