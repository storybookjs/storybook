import { useEffect, useRef } from 'react';

import { GHOST_STORIES_REQUEST, PREVIEW_INITIALIZED } from 'storybook/internal/core-events';
import { useStorybookApi } from 'storybook/manager-api';

/** Delay before firing ghost stories after PREVIEW_INITIALIZED (10 minutes). */
const TRIGGER_DELAY_MS = 10 * 60 * 1000;

/**
 * Fires a one-time GHOST_STORIES_REQUEST event 10 minutes after the preview
 * initializes. The server-side handler in ghost-stories-channel.ts enforces
 * the once-ever-per-project gate via lastEvents cache, so this hook is
 * fire-and-forget.
 */
export function useGhostStoriesTrigger(): void {
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
      api.emit(GHOST_STORIES_REQUEST);
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
