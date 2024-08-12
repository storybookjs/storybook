import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { exec } from './vitest';

console.log('preset from experimental-coverage');

export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  console.log('the serverchannel was ran!');
  exec(channel);
  return channel;
};
