import type { Args, StoryContext } from '@storybook/csf';

import { SNIPPET_RENDERED } from '../../../docs-tools';
import { addons, useEffect, useRef, useState } from '../addons';

type ReducedStoryContext = Omit<
  StoryContext<any, Args>,
  'abortSignal' | 'canvasElement' | 'step' | 'context'
>;

type Transformer =
  | ((code: string, storyContext: ReducedStoryContext) => string | Promise<string>)
  | undefined;

export async function emitTransformCode(source: string | undefined, context: ReducedStoryContext) {
  const transform = context.parameters?.docs?.source?.transform as Transformer;
  const { id, unmappedArgs } = context;

  const transformed = transform && source ? transform?.(source, context) : source;
  const result = transformed ? await transformed : undefined;

  addons.getChannel().emit(SNIPPET_RENDERED, {
    id,
    source: result,
    args: unmappedArgs,
  });
}
