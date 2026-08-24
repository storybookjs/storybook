import { SourceType } from './shared.ts';

export type StoryDocsCodePanelParameters = {
  __isArgsStory?: boolean;
  __isPortableStory?: boolean;
  docs?: {
    source?: {
      code?: string;
      type?: SourceType;
    };
  };
};

/** Whether StoryDocs should build a dynamic snippet for this story. */
export function isStoryDocsSnippetEligible(
  parameters?: StoryDocsCodePanelParameters,
  typeOverride?: SourceType
): boolean {
  const sourceParams = parameters?.docs?.source;
  const isArgsStory = parameters?.__isArgsStory;
  const type = typeOverride ?? sourceParams?.type;

  if (parameters?.__isPortableStory || sourceParams?.code !== undefined) {
    return false;
  }

  if (type === SourceType.DYNAMIC) {
    return true;
  }

  return Boolean(isArgsStory && type !== SourceType.CODE);
}

/**
 * Whether the Code panel should keep rendering blank while it waits for a story-docs service snippet
 * instead of falling back to raw CSF (`originalSource`).
 *
 * True while StoryDocs might still produce a snippet for the current story: either the story is
 * eligible, or it is not prepared yet so eligibility — which depends on prepared parameters like
 * `__isArgsStory` — is still unknown in the manager. Holding the fallback during that window
 * prevents flashing raw CSF before the service snippet arrives for newly opened stories.
 */
export function shouldWaitForServiceSnippet(
  parameters: StoryDocsCodePanelParameters | undefined,
  storyPrepared: boolean | undefined
): boolean {
  if (!globalThis.FEATURES?.experimentalDocgenServer) {
    return false;
  }
  return !storyPrepared || isStoryDocsSnippetEligible(parameters);
}
