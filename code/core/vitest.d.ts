import 'vitest';

import { type LiveRegionMatcherOptions } from './core/src/shared/utils/toHaveLiveRegion';

interface CustomMatchers<R = unknown> {
  toMatchPaths(paths: string[]): R;
  toHaveLiveRegion(options: LiveRegionMatcherOptions): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
