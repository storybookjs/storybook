import * as fs from 'node:fs/promises';
import path from 'node:path';

import { type Check, CompatibilityType } from './index';

const configPath = '.storybook';

/**
 * When configDir already exists, prompt:
 *
 * - Yes -> overwrite (delete)
 * - No -> exit
 */
const name = '.storybook directory';
export const configDir: Check = {
  condition: async (context, state) => {
    return fs
      .stat(path.join(state.directory, configPath))
      .then(() => ({
        type: CompatibilityType.INCOMPATIBLE,
        reasons: ['exists'],
      }))
      .catch(() => ({ type: CompatibilityType.COMPATIBLE }));

    return {
      type: CompatibilityType.INCOMPATIBLE,
      reasons: ['bad context'],
    };
  },
};
