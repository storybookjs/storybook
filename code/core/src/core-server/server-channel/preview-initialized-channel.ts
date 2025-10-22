import type { Channel } from 'storybook/internal/channels';
import { PREVIEW_INITIALIZED } from 'storybook/internal/core-events';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { getLastEvents } from '../../telemetry/event-cache';
import { getSessionId } from '../../telemetry/session-id';

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
          const isInitSession = lastInit?.sessionId === sessionId;
          const timeSinceInit = lastInit ? Date.now() - lastInit.timestamp : undefined;
          telemetry('preview-first-load', { timeSinceInit, isInitSession, userAgent });
        }
      } catch (e) {
        // do nothing
      }
    }
  });
}
