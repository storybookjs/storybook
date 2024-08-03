import type { Args, StoryId } from '@storybook/core/types';
import { combineArgs, mapArgsToTypes, validateOptions, deepDiff, DEEPLY_EQUAL } from './args';
import type { PreparedStory } from '@storybook/core/types';

function deleteUndefined(obj: Record<string, any>) {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
}

export class ArgsStore {
  initialArgsByStoryId: Record<StoryId, Args> = {};

  argsByStoryId: Record<StoryId, Args> = {};

  get(storyId: StoryId) {
    if (!(storyId in this.argsByStoryId)) {
      throw new Error(`No args known for ${storyId} -- has it been rendered yet?`);
    }

    return this.argsByStoryId[storyId];
  }

  setInitial(story: PreparedStory<any>) {
    if (!this.initialArgsByStoryId[story.id]) {
      this.initialArgsByStoryId[story.id] = story.initialArgs;
      this.argsByStoryId[story.id] = story.initialArgs;
    } else if (this.initialArgsByStoryId[story.id] !== story.initialArgs) {
      // When we get a new version of a story (with new initialArgs), we re-apply the same diff
      // that we had previously applied to the old version of the story
      const delta = deepDiff(this.initialArgsByStoryId[story.id], this.argsByStoryId[story.id]);
      this.initialArgsByStoryId[story.id] = story.initialArgs;
      this.argsByStoryId[story.id] = story.initialArgs;
      if (delta !== DEEPLY_EQUAL) {
        this.updateFromDelta(story, delta);
      }
    }
  }

  updateFromDelta(story: PreparedStory<any>, delta: Args) {
    // Use the argType to ensure we setting a type with defined options to something outside of that
    const validatedDelta = validateOptions(delta, story.argTypes);

    // NOTE: we use `combineArgs` here rather than `combineParameters` because changes to arg
    // array values are persisted in the URL as sparse arrays, and we have to take that into
    // account when overriding the initialArgs (e.g. we patch [,'changed'] over ['initial', 'val'])
    this.argsByStoryId[story.id] = combineArgs(this.argsByStoryId[story.id], validatedDelta);
  }

  updateFromPersisted(story: PreparedStory<any>, persisted: Args) {
    // Use the argType to ensure we aren't persisting the wrong type of value to the type.
    // For instance you could try and set a string-valued arg to a number by changing the URL
    const mappedPersisted = mapArgsToTypes(persisted, story.argTypes);

    return this.updateFromDelta(story, mappedPersisted);
  }

  update(storyId: StoryId, argsUpdate: Partial<Args>) {
    if (!(storyId in this.argsByStoryId)) {
      throw new Error(`No args known for ${storyId} -- has it been rendered yet?`);
    }

    this.argsByStoryId[storyId] = deleteUndefined({
      ...this.argsByStoryId[storyId],
      ...argsUpdate,
    });
  }
}
