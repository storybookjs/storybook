import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import { featureEntry } from '../entries.ts';
import type { MeasureTypes } from './preview.ts';

export default defineAddon<void, MeasureTypes>(() => ({
  meta: { name: 'storybook/measure', order: 2 },
  manager: featureEntry('measure', 'manager'),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [featureEntry('measure', 'preview')]);
  },
}));
