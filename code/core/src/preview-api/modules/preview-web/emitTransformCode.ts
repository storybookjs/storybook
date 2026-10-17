import type { Args, StoryContext } from 'storybook/internal/csf';

import { SNIPPET_RENDERED } from '../../../docs-tools/index.ts';
import { addons } from '../addons/index.ts';

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

  // Note: The snippet payload emitted via SNIPPET_RENDERED is already transformed.
  addons.getChannel().emit(SNIPPET_RENDERED, {
    id,
    source: result,
    args: unmappedArgs,
  });
}
