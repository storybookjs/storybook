import type { PreparedStory } from 'storybook/internal/types';
import type { Args, StoryId } from 'storybook/internal/types';

import { isPlainObject } from 'es-toolkit/predicate';

import { DEEPLY_EQUAL, combineArgs, deepDiff, mapArgsToTypes, validateOptions } from './args';

function deleteUndefined(obj: Record<string, any>) {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
}

/**
 * Merges an arg update into the current value, preserving function properties from the current
 * value that are not present in the update.
 *
 * This is needed because function args cannot be serialized through the channel (from preview to
 * manager), so the manager's view of object args is missing function properties. When the manager
 * sends back an update, we must not discard functions that were present in the preview's current
 * args.
 */
function mergeArgsPreservingFunctions(current: any, update: any): any {
  if (!isPlainObject(current) || !isPlainObject(update)) {
    return update;
  }
  const result: Record<string, any> = { ...update };
  for (const [key, value] of Object.entries(current)) {
    if (!(key in update) && typeof value === 'function') {
      // Preserve function properties that weren't included in the update
      result[key] = value;
    } else if (key in update && isPlainObject(value) && isPlainObject(update[key])) {
      // Recursively merge nested plain objects
      result[key] = mergeArgsPreservingFunctions(value, update[key]);
    }
  }
  return result;
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

    const current = this.argsByStoryId[storyId];
    const merged: Record<string, any> = {};
    for (const key of new Set([...Object.keys(current), ...Object.keys(argsUpdate)])) {
      if (key in argsUpdate) {
        merged[key] = mergeArgsPreservingFunctions(current[key], argsUpdate[key]);
      } else {
        merged[key] = current[key];
      }
    }
    this.argsByStoryId[storyId] = deleteUndefined(merged);
  }
}
