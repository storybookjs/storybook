import type { Options } from 'storybook/internal/types';
import type { Channel } from 'storybook/internal/channels';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  return channel;
};
