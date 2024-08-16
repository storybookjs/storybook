import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { CoverageManager } from './node/coverage-manager';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';

  new CoverageManager(channel);

  return channel;
};
