import { resolveModule } from '../../shared/utils/resolve';

export const DEBOUNCE = 100;

export const defaultStaticDirs = [
  {
    from: resolveModule({
      pkg: 'storybook',
      customSuffix: 'assets/browser',
    }),
    to: '/sb-common-assets',
  },
];

export const defaultFavicon = resolveModule({
  pkg: 'storybook',
  customSuffix: 'assets/browser/favicon.svg',
});
