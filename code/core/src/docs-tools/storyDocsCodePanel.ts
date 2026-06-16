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
