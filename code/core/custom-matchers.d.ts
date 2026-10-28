import '@storybook/core/test';

import type { LiveRegionMatcherOptions } from '../../../core/src/utils/toHaveLiveRegion';

declare module '@storybook/core/test' {
  interface Assertion<T> {
    toHaveLiveRegion(options: LiveRegionMatcherOptions): Promise<void>;
  }
}
