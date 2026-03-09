import type { Channel } from 'storybook/internal/channels';
import {
  PREVIEW_INITIALIZED,
  SHARE_ISOLATE_MODE,
  SHARE_POPOVER_OPENED,
  SHARE_STORY_LINK,
} from 'storybook/internal/core-events';
import { type InitPayload, telemetry } from 'storybook/internal/telemetry';
import { type CacheEntry, getLastEvents } from 'storybook/internal/telemetry';
import { getSessionId } from 'storybook/internal/telemetry';
import type { Options } from 'storybook/internal/types';

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

export function initTelemetryChannel(channel: Channel, options: Options) {
  if (!options.disableTelemetry) {
    channel.on(PREVIEW_INITIALIZED, async ({ userAgent }) => {
      try {
        const sessionId = await getSessionId();
        const lastEvents = await getLastEvents();
        const lastInit = lastEvents.init;
        const lastPreviewFirstLoad = lastEvents['preview-first-load'];
        if (!lastPreviewFirstLoad) {
          const payload = makePayload(userAgent, lastInit, sessionId);
          telemetry('preview-first-load', payload);
        }
      } catch {}
    });
    channel.on(SHARE_POPOVER_OPENED, async () => {
      telemetry('share', { action: 'popover-opened' });
    });
    channel.on(SHARE_STORY_LINK, async () => {
      telemetry('share', { action: 'story-link-copied' });
    });
    channel.on(SHARE_ISOLATE_MODE, async () => {
      telemetry('share', { action: 'isolate-mode-opened' });
    });
  }
}
