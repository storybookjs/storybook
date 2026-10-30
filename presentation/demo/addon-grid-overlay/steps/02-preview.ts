import { fileURLToPath } from 'node:url';

import { defineAddon } from 'storybook';

export default defineAddon(() => ({
  meta: { name: 'storybook-addon-grid-overlay' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/preview')),
    ]);
  },
}));
