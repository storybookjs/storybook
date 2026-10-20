import { useEffect, useState } from 'react';

import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import type { Globals } from 'storybook/internal/csf';
import { buildArgsParam } from 'storybook/internal/router';
import type { DocsContextProps, PreparedStory } from 'storybook/internal/types';

/**
 * Serializes the user's current globals the same way the manager does for its "Open in isolation
 * mode" link (see `buildArgsParam` usage in `manager-api`'s `url` module), so docs preview links
 * can carry the active globals. Globals still at their default are omitted, matching the manager's
 * URL. Returns an empty string when there is no story (e.g. a loading preview).
 */
export const useGlobalsParam = (
  story: PreparedStory | undefined,
  context: DocsContextProps
): string => {
  const storyContext = story && context.getStoryContext(story);

  const [param, setParam] = useState(() =>
    storyContext ? buildArgsParam(storyContext.initialGlobals, storyContext.globals) : ''
  );

  useEffect(() => {
    if (!story) {
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
  }, [context.channel, story]);

  return param;
};
