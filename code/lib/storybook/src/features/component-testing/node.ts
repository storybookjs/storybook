import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

export default defineAddon(() => ({
  meta: { name: 'storybook/component-testing', order: 5 },
  manager: 'src/features/component-testing/manager.tsx',
  setup(): void {},
}));
