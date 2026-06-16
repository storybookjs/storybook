import { SourceType } from './shared.ts';

export type StoryDocsCodePanelParameters = {
  __isArgsStory?: boolean;
  docs?: {
    source?: {
      code?: string;
      type?: SourceType;
    };
  };
};

/**
 * Whether the preview story-docs hook should skip emitting a snippet to the manager Code panel.
 *
 * Mirrors {@link skipJsxRender} in the React `jsxDecorator` so static service snippets replace
 * dynamic JSX rendering under the same conditions.
 */
export function shouldSkipStoryDocsEmit(parameters?: StoryDocsCodePanelParameters): boolean {
  const sourceParams = parameters?.docs?.source;
  const isArgsStory = parameters?.__isArgsStory;

  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  return !isArgsStory || sourceParams?.code !== undefined || sourceParams?.type === SourceType.CODE;
}

/** Whether the Code panel should wait for a story-docs service snippet instead of showing raw CSF. */
export function expectsStoryDocsCodePanelSnippet(
  parameters?: StoryDocsCodePanelParameters
): boolean {
  return (
    Boolean(globalThis.FEATURES?.experimentalDocgenServer) && !shouldSkipStoryDocsEmit(parameters)
  );
}

/**
 * Whether the Code panel should keep rendering blank while it waits for a story-docs service snippet
 * instead of falling back to raw CSF (`originalSource`).
 *
 * True while the docgen server might still emit a snippet for the current story: either the story is
 * known to emit one, or it is not prepared yet so the emit decision — which depends on prepared
 * parameters like `__isArgsStory` — is still unknown in the manager. Holding the fallback during
 * that window prevents flashing raw CSF before the service snippet arrives for newly opened stories.
 */
export function shouldWaitForServiceSnippet(
  parameters: StoryDocsCodePanelParameters | undefined,
  storyPrepared: boolean | undefined
): boolean {
  if (!globalThis.FEATURES?.experimentalDocgenServer) {
    return false;
  }
  return !storyPrepared || !shouldSkipStoryDocsEmit(parameters);
}
