import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { HighlightTypes } from './preview.ts';

export default defineAddon<void, HighlightTypes>(() => ({
  meta: { name: 'storybook/highlight' },
  setup(): void {},
}));
