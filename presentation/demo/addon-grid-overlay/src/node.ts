import { fileURLToPath } from 'node:url';

import { defineAddon } from 'storybook';

/** Options a project passes from `main.ts`. */
export interface GridOverlayOptions {
  /** Cell size in pixels. */
  size?: number;
  /** Line color, any CSS color. */
  color?: string;
}

export default defineAddon<GridOverlayOptions | void>(({ size = 8, color = 'rgba(255, 71, 133, 0.35)' } = {}) => ({
  meta: { name: 'storybook-addon-grid-overlay' },
  manager: fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/manager')),
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', () => [
      fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/preview')),
    ]);
    storybook.hook('server:app:extend', (app) =>
      app.get('/grid-overlay/settings', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ size, color }));
      })
    );
  },
}));
