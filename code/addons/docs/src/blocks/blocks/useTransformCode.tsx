import { useEffect, useState } from 'react';

import type { Args, StoryContext } from 'storybook/internal/csf';

type ReducedStoryContext = Omit<
  StoryContext<any, Args>,
  'abortSignal' | 'canvasElement' | 'step' | 'context'
>;

export function useTransformCode(
  source: string,
  transform: (code: string, storyContext: ReducedStoryContext) => string | Promise<string>,
  storyContext: ReducedStoryContext
) {
  const transformed = transform ? transform?.(source, storyContext) : source;
  const isPromise =
    typeof transformed === 'object' && typeof (transformed as Promise<string>)?.then === 'function';

  // Synchronous transforms (including the identity transform used when there is nothing to
  // transform) are rendered directly, avoiding a needless "Transforming..." -> value state
  // update and the extra re-render that comes with it. Only asynchronous transforms stage
  // their result through state.
  const [transformedCode, setTransformedCode] = useState(
    isPromise ? 'Transforming...' : (transformed as string)
  );

  useEffect(() => {
    if (!isPromise) {
      return;
    }

    let cancelled = false;
    Promise.resolve(transformed).then((transformResult) => {
      if (!cancelled) {
        setTransformedCode((current) => (current !== transformResult ? transformResult : current));
      }
    });

    return () => {
      cancelled = true;
    };
  });

  return isPromise ? transformedCode : (transformed as string);
}
