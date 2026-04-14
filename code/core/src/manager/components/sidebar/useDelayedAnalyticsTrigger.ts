import { useEffect, useRef } from 'react';

import {
  AI_PREPARE_ANALYTICS_REQUEST,
  GHOST_STORIES_REQUEST,
  PREVIEW_INITIALIZED,
} from 'storybook/internal/core-events';
import { global } from '@storybook/global';
import { useStorybookApi } from 'storybook/manager-api';

/** Delay before firing ghost stories after PREVIEW_INITIALIZED (4 minutes). */
const TRIGGER_DELAY_MS = 4 * 60 * 1000;

/**
 * Fires one-time analytics events 10 minutes after the preview initializes.
 * The server-side handlers for those events enforce the once-ever-per-project
 * gate via lastEvents cache, so this hook is fire-and-forget.
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

      // if `ai prepare` is in the same session, we run ghost stories and ai prepare analytics.
      if (
        global.STORYBOOK_LAST_EVENTS?.['ai-prepare']?.body.sessionId === global.STORYBOOK_SESSION_ID
      ) {
        api.emit(GHOST_STORIES_REQUEST);
        api.emit(AI_PREPARE_ANALYTICS_REQUEST);
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
