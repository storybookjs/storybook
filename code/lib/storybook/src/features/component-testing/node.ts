import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import { featureEntry } from '../entries.ts';

export default defineAddon(() => ({
  meta: { name: 'storybook/component-testing', order: 5 },
  manager: featureEntry('component-testing', 'manager'),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      featureEntry('component-testing', 'preview'),
    ]);
  },
}));
