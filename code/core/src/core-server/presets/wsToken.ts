import { randomUUID } from 'crypto';

/**
 * This function generates a WebSocket token and stores it in the global scope, ensuring it is a
 * singleton.
 *
 * This is because otherwise there is a cyclical dependency between the server channel and the
 * presets:
 *
 * 1. Token is needed to create the server channel
 * 2. Initial loading of all presets needs the server channel
 * 3. Core preset needs to have the token in its channel options
 *
 * By making the token a shared singleton, we can ensure that both the server channel and the
 * presets have access to the same token without creating this circular dependency.
 */
export const getWsToken = () => {
  if (!globalThis.STORYBOOK_WEBSOCKET_TOKEN) {
    globalThis.STORYBOOK_WEBSOCKET_TOKEN = randomUUID();
  }
  return globalThis.STORYBOOK_WEBSOCKET_TOKEN;
};
