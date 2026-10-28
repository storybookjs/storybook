import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { ViewportTypes } from './preview.ts';

export default defineAddon<void, ViewportTypes>(() => ({
  meta: { name: 'storybook/viewport', order: 7 },
  manager: 'src/features/viewport/manager.tsx',
  setup(): void {},
}));
