import type {
  ChannelEvent,
  ChannelHandler,
  ChannelTransport,
} from '@storybook/core/internal/channels';

export function createTransportPair(): [ChannelTransport, ChannelTransport] {
  let first: ChannelHandler | undefined;
  let second: ChannelHandler | undefined;
  const deliver = (handler: ChannelHandler | undefined, event: ChannelEvent): void => {
    queueMicrotask(() => handler?.(structuredClone(event)));
  };
  return [
    {
      send: (event) => deliver(second, event),
      setHandler: (handler) => {
        first = handler;
      },
    },
    {
      send: (event) => deliver(first, event),
      setHandler: (handler) => {
        second = handler;
      },
    },
  ];
}
