import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';

import type { ThemesTypes } from './types.ts';

export default defineAddon<void, ThemesTypes>(() => ({
  meta: { name: '@storybook/addon-themes' },
  manager: fileURLToPath(import.meta.resolve('@storybook/addon-themes/manager')),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('@storybook/addon-themes/preview')),
    ]);
  },
}));
