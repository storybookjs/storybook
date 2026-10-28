import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';

import type { A11yTypes } from './types.ts';

export default defineAddon<void, A11yTypes>(() => ({
  meta: { name: '@storybook/addon-a11y' },
  manager: fileURLToPath(import.meta.resolve('@storybook/addon-a11y/manager')),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('@storybook/addon-a11y/preview')),
    ]);
  },
}));
