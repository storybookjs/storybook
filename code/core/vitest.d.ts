import 'vitest';

import 'storybook/test';

import { type LiveRegionMatcherOptions } from './core/src/shared/utils/toHaveLiveRegion';

interface CustomMatchers<R = unknown> {
  toMatchPaths(paths: string[]): R;
  toHaveLiveRegion(options: LiveRegionMatcherOptions): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

declare module 'storybook/test' {
  interface Assertion<T> {
    toHaveLiveRegion(options: LiveRegionMatcherOptions): Promise<void>;
  }
}
