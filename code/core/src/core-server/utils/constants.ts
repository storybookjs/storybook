import { dirname, join } from 'node:path';

export const DEBOUNCE = 100;

export const defaultStaticDirs = [
  {
    from: join(dirname(require.resolve('storybook/internal/package.json')), 'assets', 'browser'),
    to: '/sb-common-assets',
  },
];
