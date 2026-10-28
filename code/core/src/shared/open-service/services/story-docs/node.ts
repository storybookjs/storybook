import { defineAddon } from '../../../../instance/plugins.ts';

import setup from '#story-docs-addon-setup';

export default defineAddon(() => ({
  meta: { name: 'storybook/story-docs' },
  setup,
}));
