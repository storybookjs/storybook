import type { Viewport } from './types.ts';

/** @deprecated Will be removed in Storybook 11 */
export const responsiveViewport: Viewport = {
  name: 'Reset viewport',
  styles: {
    height: '100%',
    width: '100%',
  },
  type: 'desktop',
};
