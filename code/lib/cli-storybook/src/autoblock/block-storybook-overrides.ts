import { versions } from 'storybook/internal/common';

import {
  STORYBOOK_OVERRIDES_TITLE,
  getStorybookOverridesSummary,
} from '../doctor/getStorybookOverridesSummary.ts';
import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'storybookOverrides',
  async check({ packageManager }) {
    return (
      getStorybookOverridesSummary({ packageManager, targetVersion: versions.storybook }) ?? false
    );
  },
  log(summary) {
    return {
      title: STORYBOOK_OVERRIDES_TITLE,
      message: `${summary}\nThen run the upgrade again.`,
    };
  },
});
