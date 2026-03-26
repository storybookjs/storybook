import 'vitest';

import { type LiveRegionMatcherOptions } from './core/src/shared/utils/toHaveLiveRegion';

interface CustomMatchers<R = unknown> {
  toHaveLiveRegion(options: LiveRegionMatcherOptions): { pass: boolean; message: () => string };
  toMatchPaths(paths: string[]): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
