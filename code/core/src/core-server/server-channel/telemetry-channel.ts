import type { Channel } from 'storybook/internal/channels';
import {
  PREVIEW_INITIALIZED,
  SHARE_ISOLATE_MODE,
  SIDEBAR_FILTER_CHANGED,
  AI_PROMPT_NUDGE,
} from 'storybook/internal/core-events';
import { type InitPayload, telemetry } from 'storybook/internal/telemetry';
import { type CacheEntry, getLastEvents } from 'storybook/internal/telemetry';
import { getSessionId } from 'storybook/internal/telemetry';

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

export function initTelemetryChannel(channel: Channel) {
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
  channel.on(SHARE_ISOLATE_MODE, async () => {
    telemetry('share', { action: 'isolate-mode-opened' });
  });
  channel.on(SIDEBAR_FILTER_CHANGED, (payload) => {
    telemetry('sidebar-filter', payload);
  });
  channel.on(AI_PROMPT_NUDGE, async ({ id, origin }: { id: string; origin: string }) => {
    telemetry('ai-prompt-nudge', { id, origin });
  });
}
