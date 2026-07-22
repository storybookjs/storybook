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
