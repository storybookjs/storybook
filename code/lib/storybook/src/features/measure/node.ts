import { defineAddon } from '@storybook/core/internal/deep/instance/plugins';

import type { MeasureTypes } from './preview.ts';

export default defineAddon<void, MeasureTypes>(() => ({
  meta: { name: 'storybook/measure', order: 2 },
  manager: 'src/features/measure/manager.tsx',
  setup(): void {},
}));
