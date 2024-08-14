import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { exec } from './node/vitest';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  exec(channel);
  return channel;
};
