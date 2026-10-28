import { randomUUID } from 'node:crypto';

import { getInstanceContext } from '@storybook/core/internal/deep/shared/instance-context';

const WS_TOKEN = Symbol.for('storybook.instance.ws-token');

export const getWsToken = (): string => {
  const context = getInstanceContext();
  if (context) {
    let token = context.state.get(WS_TOKEN) as string | undefined;
    if (!token) {
      token = randomUUID();
      context.state.set(WS_TOKEN, token);
    }
    return token;
  }
  return (globalThis.STORYBOOK_WEBSOCKET_TOKEN ||= randomUUID());
};
