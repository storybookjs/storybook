import { useEffect, useRef } from 'react';

import {
  AI_SETUP_ANALYTICS_REQUEST,
  GHOST_STORIES_REQUEST,
  PREVIEW_INITIALIZED,
} from 'storybook/internal/core-events';
import { global } from '@storybook/global';
import { useStorybookApi } from 'storybook/manager-api';

/** Delay before firing ghost stories after PREVIEW_INITIALIZED (4 minutes). */
const TRIGGER_DELAY_MS = 4 * 60 * 1000;

/**
 * After the preview initializes, waits then may request ghost-story capture and AI-setup
 * analytics. Emissions only occur when `ai-setup` telemetry exists for the current session;
 * server-side handlers apply additional lastEvents gates.
 */
export function useDelayedAnalyticsTrigger(): void {
  const api = useStorybookApi();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const fire = () => {
      if (fired.current) {
        return;
      }
      fired.current = true;

      const lastEvents = global.STORYBOOK_LAST_EVENTS;
      const aiSetupEvent = lastEvents?.['ai-setup'];

      if (aiSetupEvent && aiSetupEvent.body.sessionId === global.STORYBOOK_SESSION_ID) {
        api.emit(GHOST_STORIES_REQUEST);
        api.emit(AI_SETUP_ANALYTICS_REQUEST);
      }
    };

    const onInit = () => {
      timeoutId = setTimeout(fire, TRIGGER_DELAY_MS);
    };

    api.once(PREVIEW_INITIALIZED, onInit);

    return () => {
      api.off(PREVIEW_INITIALIZED, onInit);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [api]);
}
