import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';

export default defineAddon(() => ({
  meta: { name: '@storybook/addon-links' },
  manager: fileURLToPath(import.meta.resolve('@storybook/addon-links/manager')),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('@storybook/addon-links/preview')),
    ]);
  },
}));
