import { versions } from 'storybook/internal/common';

import {
  STORYBOOK_OVERRIDES_TITLE,
  getStorybookOverrides,
  getStorybookOverridesSummary,
} from '../doctor/getStorybookOverrides.ts';
import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'storybookOverrides',
  async check({ packageManager }) {
    const overrides = getStorybookOverrides({ packageManager, targetVersion: versions.storybook });
    return overrides.length > 0 && overrides;
  },
  log(overrides) {
    return {
      title: STORYBOOK_OVERRIDES_TITLE,
      message: getStorybookOverridesSummary(overrides, versions.storybook),
    };
  },
});
