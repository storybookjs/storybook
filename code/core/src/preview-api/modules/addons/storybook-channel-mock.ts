import { Channel } from 'storybook/internal/channels';

export function mockChannel() {
  const transport = {
    setHandler: () => {},
    send: () => {},
  };

  return new Channel({ transport });
}
