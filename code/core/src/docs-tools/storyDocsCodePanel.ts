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

/**
 * Whether the preview story-docs hook should skip emitting a snippet to the manager Code panel.
 *
 * The args/source shape logic mirrors {@link skipJsxRender} in the React `jsxDecorator`, so static
 * service snippets replace dynamic JSX rendering under the same conditions. It additionally skips
 * portable stories (vitest, playwright/jest portable): those have no manager Code panel and no OSA
 * server peer, so the `extractStoryDocs` remote command has no handler and would reject after the
 * ack timeout — there is nothing to emit to.
 */
export function shouldSkipStoryDocsEmit(parameters?: StoryDocsCodePanelParameters): boolean {
  const sourceParams = parameters?.docs?.source;
  const isArgsStory = parameters?.__isArgsStory;

  if (parameters?.__isPortableStory) {
    return true;
  }

  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  return !isArgsStory || sourceParams?.code !== undefined || sourceParams?.type === SourceType.CODE;
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
