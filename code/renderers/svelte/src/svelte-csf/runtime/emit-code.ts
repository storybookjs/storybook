import { logger } from 'storybook/internal/client-logger';
import { SourceType, SNIPPET_RENDERED, UnprintableArgError } from 'storybook/internal/docs-tools';
import { addons } from 'storybook/internal/preview-api';

import { fillTemplate } from '../../docs/fill-template.ts';
import type { StoryContext } from '../types.ts';

type Params = {
  args: Record<string, any>;
  storyContext: StoryContext<Record<string, any>>;
};

const channel: ReturnType<(typeof addons)['getChannel']> | undefined = addons.getChannel();

/**
 * Fills the story's template, written by the compiler next to its raw code, with the current args,
 * and emits the result to Storybook's internal code provider, so that the source code viewer shows
 * it. Without a template, or with an arg the template cannot show, it emits the raw code.
 */
export const emitCode = (params: Params) => {
  const { storyContext } = params;

  if (skipSourceRender(storyContext)) {
    return;
  }

  const { rawCode, template } = storyContext.parameters.__svelteCsf;
  let codeToEmit = rawCode;
  try {
    codeToEmit = template ? fillTemplate(template, params.args) : rawCode;
  } catch (error) {
    // An arg the template cannot show, such as a snippet, leaves the raw code.
    if (!(error instanceof UnprintableArgError)) {
      logger.warn(error);
    }
  }

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
