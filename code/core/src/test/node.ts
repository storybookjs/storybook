import { defineAddon } from '../instance/plugins.ts';

import type { TestTypes } from './preview.ts';

export default defineAddon<void, TestTypes>(() => ({
  meta: { name: 'storybook/test' },
  setup(): void {},
}));
