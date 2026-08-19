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

/**
 * @param warning Why `source` is an incomplete example, when it is one. Travels with the snippet so
 *   the Code panel and the docs Source block can flag it; see `StoryDoc.warning`.
 */
export async function emitTransformCode(
  source: string | undefined,
  context: ReducedStoryContext,
  warning?: string
) {
  const transform = context.parameters?.docs?.source?.transform as Transformer;
  const { id, unmappedArgs } = context;

  const transformed = transform && source ? transform?.(source, context) : source;
  const result = transformed ? await transformed : undefined;

  addons.getChannel().emit(SNIPPET_RENDERED, {
    id,
    source: result,
    args: unmappedArgs,
    warning,
  });
}
