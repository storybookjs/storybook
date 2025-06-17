import { dirname, join } from 'node:path';

export const DEBOUNCE = 100;

export const defaultStaticDirs = [
  {
    from: join(
      dirname(import.meta.resolve('storybook/internal/package.json')),
      'assets',
      'browser'
    ),
    to: '/sb-common-assets',
  },
];
