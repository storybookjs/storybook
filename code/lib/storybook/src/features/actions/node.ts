import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { ActionsTypes } from './preview.ts';

export default defineAddon<void, ActionsTypes>(() => ({
  meta: { name: 'storybook/actions', order: 3 },
  manager: 'src/features/actions/manager.tsx',
  setup(): void {},
}));
