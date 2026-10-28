import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { OutlineTypes } from './preview.ts';

export default defineAddon<void, OutlineTypes>(() => ({
  meta: { name: 'storybook/outline', order: 8 },
  manager: 'src/features/outline/manager.tsx',
  setup(): void {},
}));
