import { stringify } from 'telejson';

import type { Args, StoryId } from '../../../../types/index.ts';
import type { StoryDocsSnippetSourceParameters } from '../story-docs/snippet.ts';
import { selectSnippetForStory } from '../story-docs/snippet.ts';
import type { StoryDocsPayload } from '../story-docs/types.ts';

export type DynamicSnippetInput = {
  storyId: StoryId;
  slot: DynamicSnippetSlot;
  argsKey: string;
};

export type DynamicSnippetSlot = 'current' | 'initial';

export type DynamicSnippetRecord = {
  revision: string;
  source?: string;
  transformedSource?: string;
  warning?: string;
};

type DynamicSnippetStateEntry = {
  argsKey: string;
  record: DynamicSnippetRecord;
};

export type DynamicSnippetState = Record<
  string,
  Partial<Record<DynamicSnippetSlot, DynamicSnippetStateEntry>>
>;

type DynamicSnippetSourceParameters = StoryDocsSnippetSourceParameters & {
  originalSource?: string;
};

type DynamicSnippetStoryContext = {
  parameters: {
    docs?: {
      source?: DynamicSnippetSourceParameters;
    };
  };
};

const telejsonOptions = { maxDepth: 50 };

const stableEncode = (value: unknown): unknown => {
  if (value === undefined) {
    return { type: 'undefined' };
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableEncode);
  }

  return {
    type: 'object',
    value: Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableEncode(child)])
    ),
  };
};

const stableSerialize = (value: unknown): string => {
  const serialized = JSON.stringify(stableEncode(value));
  if (serialized === undefined) {
    throw new TypeError('Dynamic snippet inputs must be JSON-serializable.');
  }
  return serialized;
};

export function createDynamicSnippetInput(
  storyId: StoryId,
  args: Args,
  slot: DynamicSnippetSlot = 'current'
): DynamicSnippetInput {
  return {
    storyId,
    slot,
    argsKey: stableSerialize(JSON.parse(stringify(args, telejsonOptions))),
  };
}

/** Return the stable identity shared by a dynamic snippet query and its cached record. */
export const dynamicSnippetInputKey = (input: DynamicSnippetInput): string =>
  stableSerialize(input);

export const selectDynamicSnippetRecord = (
  state: DynamicSnippetState,
  input: DynamicSnippetInput
): DynamicSnippetRecord | undefined => {
  const entry = state[input.storyId]?.[input.slot];
  return entry?.argsKey === input.argsKey ? entry.record : undefined;
};

export const dynamicSnippetRevision = (
  payload: StoryDocsPayload | undefined,
  storyId: StoryId
): string =>
  stableSerialize({
    import: payload?.import,
    payloadError: payload?.error,
    story: payload?.stories[storyId],
  });

export function renderDynamicSnippetSource(
  input: DynamicSnippetInput,
  payload: StoryDocsPayload | undefined,
  storyContext: DynamicSnippetStoryContext,
  args?: Args
): string | undefined {
  const sourceParameters = storyContext.parameters.docs?.source ?? {};
  return (
    selectSnippetForStory(payload, input.storyId, args, sourceParameters.renderSnippetTemplate) ??
    sourceParameters.originalSource
  );
}
