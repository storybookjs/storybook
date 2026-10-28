import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { BackgroundTypes } from './preview.ts';

export default defineAddon<void, BackgroundTypes>(() => ({
  meta: { name: 'storybook/backgrounds', order: 4 },
  manager: 'src/features/backgrounds/manager.tsx',
  setup(): void {},
}));
