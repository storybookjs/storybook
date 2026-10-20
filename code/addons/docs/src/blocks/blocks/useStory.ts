import { useEffect, useState } from 'react';

import type { PreparedStory, Renderer, StoryId } from 'storybook/internal/types';

import type { DocsContextProps } from './DocsContext';

export function useStory<TRenderer extends Renderer = Renderer>(
  storyId: StoryId,
  context: DocsContextProps<TRenderer>
): PreparedStory<TRenderer> | void {
  const stories = useStories([storyId], context);
  return stories && stories[0];
}

export function useStories<TRenderer extends Renderer = Renderer>(
  storyIds: StoryId[],
  context: DocsContextProps<TRenderer>
): (PreparedStory<TRenderer> | void)[] {
  // Legacy docs pages can reference any story by id. Those stories will need to be
  // asynchronously loaded; we use the state for this
  const [storiesById, setStories] = useState<Record<StoryId, PreparedStory<TRenderer>>>({});
  const [errorsById, setErrors] = useState<Record<StoryId, unknown>>({});

  useEffect(() => {
    // deepscan-disable-next-line NO_EFFECT_CALL
    Promise.all(
      storyIds.map(async (storyId) => {
        // loadStory will be called every single time useStory is called
        // because useEffect does not use storyIds as an input. This is because
        // HMR can change the story even when the storyId hasn't changed. However, it
        // will be a no-op once the story has loaded. Furthermore, the `story` will
        // have an exact equality when the story hasn't changed, so it won't trigger
        // any unnecessary re-renders
        try {
          const story = await context.loadStory(storyId);
          setStories((current) =>
            current[storyId] === story ? current : { ...current, [storyId]: story }
          );
        } catch (error) {
          setErrors((current) =>
            current[storyId] === error ? current : { ...current, [storyId]: error }
          );
        }
      })
    );
  });

  return storyIds.map((storyId) => {
    if (storiesById[storyId]) {
      return storiesById[storyId];
    }

    try {
      // If we are allowed to load this story id synchonously, this will work
      return context.storyById(storyId);
    } catch (err) {
      // A story that failed to load, such as one named by an id that no story has, throws so the
      // docs page shows the error instead of a story that never arrives.
      if (storyId in errorsById) {
        throw errorsById[storyId];
      }
      return undefined;
    }
  });
}
