import { join } from 'pathe';

import { getCorePackageDir } from './package-dir.ts';

export const DEBOUNCE = 100;

export const defaultStaticDirs = [
  {
    from: join(getCorePackageDir(), 'assets/browser'),
    to: '/sb-common-assets',
  },
];

export const defaultFavicon = join(getCorePackageDir(), 'assets/browser/favicon.svg');
