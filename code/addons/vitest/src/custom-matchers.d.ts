import 'storybook/test';

import type { LiveRegionMatcherOptions } from '../../../core/src/shared/utils/toHaveLiveRegion';

declare module 'storybook/test' {
  interface Assertion<T> {
    toHaveLiveRegion(options: LiveRegionMatcherOptions): Promise<void>;
  }
}
