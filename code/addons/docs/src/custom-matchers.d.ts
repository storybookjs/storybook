import 'storybook/test';

import type { LiveRegionMatcherOptions } from '../../../core/src/shared/utils/toHaveLiveRegion.ts';

declare module 'storybook/test' {
  interface Assertion<T> {
    toHaveLiveRegion(options: LiveRegionMatcherOptions): Promise<void>;
  }
}
