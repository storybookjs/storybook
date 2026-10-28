import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { ControlsTypes } from './preview.ts';

export default defineAddon<void, ControlsTypes>(() => ({
  meta: { name: 'storybook/controls', order: 6 },
  manager: 'src/features/controls/manager.tsx',
  setup(): void {},
}));
