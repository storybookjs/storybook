import type { Channel } from 'storybook/internal/channels';
import { PREVIEW_INITIALIZED } from 'storybook/internal/core-events';
import { type InitPayload, telemetry } from 'storybook/internal/telemetry';
import { type CacheEntry, getLastEvents } from 'storybook/internal/telemetry';
import { getSessionId } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

export const makePayload = (
  userAgent: string,
  lastInit: CacheEntry | undefined,
  sessionId: string
) => {
  let timeSinceInit: number | undefined;
  const payload = {
    userAgent,
    isNewUser: false,
    timeSinceInit,
  };

  if (sessionId && lastInit?.body?.sessionId === sessionId) {
    payload.timeSinceInit = Date.now() - lastInit.timestamp;
    payload.isNewUser = !!(lastInit.body.payload as InitPayload).newUser;
  }
  return payload;
};

export function initPreviewInitializedChannel(
  channel: Channel,
  options: Options,
  _coreConfig: CoreConfig
) {
  channel.on(PREVIEW_INITIALIZED, async ({ userAgent }) => {
    if (!options.disableTelemetry) {
      try {
        const sessionId = await getSessionId();
        const lastEvents = await getLastEvents();
        const lastInit = lastEvents.init;
        const lastPreviewFirstLoad = lastEvents['preview-first-load'];
        if (!lastPreviewFirstLoad) {
          const payload = makePayload(userAgent, lastInit, sessionId);
          telemetry('preview-first-load', payload);
        }
      } catch (e) {
        // do nothing
      }
    }
  });
}
