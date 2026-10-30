import { fileURLToPath } from 'node:url';

import type { PresetPropertyFn, StorybookConfigRaw } from 'storybook/internal/types';

/** Options a project passes from `main.ts`; the loader merges them into every preset call. */
interface GridOverlayOptions {
  /** Cell size in pixels. */
  size?: number;
  /** Line color, any CSS color. */
  color?: string;
}

export const managerEntries = (entries: string[] = []): string[] => [
  ...entries,
  fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/manager')),
];

export const previewAnnotations: PresetPropertyFn<'previewAnnotations'> = (entries = []) => [
  ...entries,
  fileURLToPath(import.meta.resolve('storybook-addon-grid-overlay/preview')),
];

export const experimental_devServer: PresetPropertyFn<
  'experimental_devServer',
  StorybookConfigRaw,
  GridOverlayOptions
> = (app, { size = 8, color = 'rgba(255, 71, 133, 0.35)' }) =>
  app?.get('/grid-overlay/settings', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ size, color }));
  });
