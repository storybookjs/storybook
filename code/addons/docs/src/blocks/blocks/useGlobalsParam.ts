import { useEffect, useState } from 'react';

import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import type { Globals } from 'storybook/internal/csf';
import { buildArgsParam } from 'storybook/internal/router';
import type { DocsContextProps, StoryId } from 'storybook/internal/types';

/**
 * Serializes the user's current globals the same way the manager does for its "Open in isolation
 * mode" link (see `buildArgsParam` usage in `manager-api`'s `url` module), so docs preview links
 * can carry the active globals. Globals still at their default are omitted, matching the manager's
 * URL. Returns an empty string when there is no story (e.g. a loading preview).
 */
export const useGlobalsParam = (
  storyId: StoryId | undefined,
  context: DocsContextProps
): string => {
  const [param, setParam] = useState(() => {
    if (!storyId) {
      return '';
    }
    try {
      const { initialGlobals, globals } = context.getStoryContext(context.storyById(storyId));
      return buildArgsParam(initialGlobals, globals);
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!storyId) {
      return undefined;
    }
    const onGlobalsUpdated = ({
      initialGlobals,
      globals,
    }: {
      initialGlobals: Globals;
      globals: Globals;
    }) => {
      setParam(buildArgsParam(initialGlobals, globals));
    };
    context.channel.on(GLOBALS_UPDATED, onGlobalsUpdated);
    return () => context.channel.off(GLOBALS_UPDATED, onGlobalsUpdated);
  }, [context.channel, storyId]);

  return param;
};
