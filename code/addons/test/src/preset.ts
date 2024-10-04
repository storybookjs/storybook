import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  return channel;
};
