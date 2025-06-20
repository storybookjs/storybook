import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEBOUNCE = 100;

export const defaultStaticDirs = [
  {
    from: join(
      dirname(fileURLToPath(import.meta.resolve('storybook/internal/package.json'))),
      'assets',
      'browser'
    ),
    to: '/sb-common-assets',
  },
];

export const defaultFavicon = join(
  dirname(fileURLToPath(import.meta.resolve('storybook/internal/package.json'))),
  '/assets/browser/favicon.svg'
);
