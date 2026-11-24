import { UPDATE_STORY_ARGS } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/preview-api';

import { isEqual, isPlainObject } from 'es-toolkit/predicate';

import type { ArgSources } from '../types.ts';

type Params = {
  // The `<Story>` that reads `storyArgs` from its `args` prop
  exportName: string;
  storyArgs: Record<string, any> | undefined;
  argSources: ArgSources;
  storyId: string;
};

// Copies the plain objects and arrays in an arg value. Reading them all makes the effect that calls
// this track the `$state` inside them, and the copy does not change when that state changes.
// A cycle in the value, such as a tree with parent links, becomes the same cycle in the copy.
export const snapshotArg = (value: unknown, copies = new Map<object, unknown>()): unknown => {
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value;
  }
  if (copies.has(value)) {
    return copies.get(value);
  }
  const copy: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
  copies.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    (copy as Record<string, unknown>)[key] = snapshotArg(item, copies);
  }
  return copy;
};

// The arg values last sent to Storybook, by story. They outlive a remount of the story and a hot
// update of the stories file, so neither sends a value Storybook already has.
const sentArgsByStory = new Map<string, Record<string, unknown>>();

// Sends the args that this `<Story>` sets for the rendered story and that changed since Storybook
// last got them, so that state passed to `args` stays reactive.
export const syncStoryArgs = ({ exportName, storyArgs, argSources, storyId }: Params) => {
  let sent = sentArgsByStory.get(storyId);
  if (!sent) {
    sent = {};
    sentArgsByStory.set(storyId, sent);
  }

  const updatedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storyArgs ?? {})) {
    if (argSources[key]?.exportName !== exportName) {
      continue;
    }
    const snapshot = snapshotArg(value);
    const last = key in sent ? sent[key] : argSources[key].value;
    if (!isEqual(last, snapshot)) {
      sent[key] = snapshot;
      updatedArgs[key] = value;
    }
  }

  if (Object.keys(updatedArgs).length > 0) {
    addons.getChannel().emit(UPDATE_STORY_ARGS, { storyId, updatedArgs });
  }
};
