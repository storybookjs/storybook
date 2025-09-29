import { join } from 'pathe';

import { resolvePackageDir } from '../../shared/utils/module';

export const DEBOUNCE = 100;

export const defaultStaticDirs = [
  {
    from: join(resolvePackageDir('storybook'), 'assets/browser'),
    to: '/sb-common-assets',
  },
];

export const defaultFavicon = join(resolvePackageDir('storybook'), 'assets/browser/favicon.svg');
