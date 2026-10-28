import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

export default defineAddon(() => ({
  meta: { name: 'storybook/review', order: 1 },
  manager: '@storybook/manager/internal/deep/shared/open-service/services/review/manager',
  setup(): void {},
}));
