import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import { featureEntry } from '../entries.ts';
import type { HighlightTypes } from './preview.ts';

export default defineAddon<void, HighlightTypes>(() => ({
  meta: { name: 'storybook/highlight' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [featureEntry('highlight', 'preview')]);
  },
}));
