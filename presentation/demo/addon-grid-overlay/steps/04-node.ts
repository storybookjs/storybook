import { fileURLToPath } from 'node:url';

import { defineAddon } from 'storybook';

export default defineAddon(() => ({
  meta: { name: 'storybook-addon-grid-overlay' },
  manager: fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/manager')),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/preview')),
    ]);
    storybook.hook('server:app:extend', (app) =>
      app.get('/grid-overlay/settings', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ size: 8, color: 'rgba(255, 71, 133, 0.35)' }));
      })
    );
  },
}));
