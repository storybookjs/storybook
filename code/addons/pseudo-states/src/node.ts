import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';

import type { PseudoTypes } from './types.ts';

export default defineAddon<void, PseudoTypes>(() => ({
  meta: { name: 'storybook-addon-pseudo-states' },
  manager: fileURLToPath(import.meta.resolve('storybook-addon-pseudo-states/manager')),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('storybook-addon-pseudo-states/preview')),
    ]);
  },
}));
