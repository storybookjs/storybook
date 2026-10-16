import { SourceType, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons } from 'storybook/internal/preview-api';
import { generateCodeToEmit } from '../../docgen/story-docs/print/svelte-props.ts';

export { generateCodeToEmit } from '../../docgen/story-docs/print/svelte-props.ts';

import type { StoryContext } from '../types.ts';

type Params = {
  args: Record<string, any>;
  storyContext: StoryContext<Record<string, any>>;
};

const channel: ReturnType<(typeof addons)['getChannel']> | undefined = addons.getChannel();

/**
 * Given a code string representing the raw source code for the story,
 * and the current, dynamic args
 * this function:
 * 1. Replaces args references in the code with the actual values
 * 2. Emits the final code to Storybook's internal code provider
 * So that it can be shown in source code viewer
 */
export const emitCode = (params: Params) => {
  if (globalThis.FEATURES?.docgenServer) return;
  const { storyContext } = params;

  if (skipSourceRender(storyContext)) {
    return;
  }

  const codeToEmit = generateCodeToEmit({
    code: storyContext.parameters.__svelteCsf.rawCode,
    args: params.args,
  });

  // Using setTimeout here to ensure we're emitting after the base @storybook/svelte emits its version of the code
  // TODO: fix this in @storybook/svelte, don't emit when using stories.svelte files
  setTimeout(() => {
    channel.emit(SNIPPET_RENDERED, {
      id: storyContext.id,
      args: storyContext.unmappedArgs,
      source: codeToEmit,
    });
  });
};

// Copied from @storybook/svelte at https://github.com/storybookjs/storybook/blob/17b7512c60256c739b890b3d85aaac992806dee6/code/renderers/svelte/src/docs/sourceDecorator.ts#L16-L33
const skipSourceRender = (context: Params['storyContext']) => {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;
  const rawCode = context?.parameters.__svelteCsf?.rawCode;

  if (!rawCode) {
    return true;
  }

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
};
