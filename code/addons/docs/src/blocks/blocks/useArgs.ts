import { useCallback, useEffect, useState } from 'react';

import {
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import type { Args, DocsContextProps, PreparedStory } from 'storybook/internal/types';

export const useArgs = (
  story: PreparedStory,
  context: DocsContextProps
): [Args, (args: Args) => void, (argNames?: string[]) => void] => {
  const result = useArgsIfDefined(story, context);

  if (!result) {
    throw new Error('No result when story was defined');
  }
  return result;
};

export const useArgsIfDefined = (
  story: PreparedStory | void,
  context: DocsContextProps
): [Args, (args: Args) => void, (argNames?: string[]) => void] | void => {
  const storyContext = story ? context.getStoryContext(story) : { unmappedArgs: {} };
  const { id: storyId } = story || { id: 'none' };

  // The context's `args` are the rendered args: `argTypes.mapping` applied and hidden conditional
  // args removed. The store and `STORY_ARGS_UPDATED` carry the unmapped args, so start from those.
  const [args, setArgs] = useState<Args>(storyContext.unmappedArgs);
  useEffect(() => {
    const onArgsUpdated = (changed: { storyId: string; args: Args }) => {
      if (changed.storyId === storyId) {
        setArgs(changed.args);
      }
    };
    context.channel.on(STORY_ARGS_UPDATED, onArgsUpdated);
    return () => context.channel.off(STORY_ARGS_UPDATED, onArgsUpdated);
  }, [storyId, context.channel]);
  const updateArgs = useCallback(
    (updatedArgs: any) => context.channel.emit(UPDATE_STORY_ARGS, { storyId, updatedArgs }),
    [storyId, context.channel]
  );
  const resetArgs = useCallback(
    (argNames?: string[]) => context.channel.emit(RESET_STORY_ARGS, { storyId, argNames }),
    [storyId, context.channel]
  );
  return story && [args, updateArgs, resetArgs];
};
