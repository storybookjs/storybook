import { useEffect, useState } from 'react';

import type { Args, Renderer, StoryContext } from 'storybook/internal/csf';

type ReducedStoryContext = Omit<
  StoryContext<Renderer, Args>,
  'abortSignal' | 'canvasElement' | 'step' | 'context'
>;

export function useTransformCode(
  source: string,
  transform:
    | ((code: string, storyContext: ReducedStoryContext) => string | Promise<string>)
    | undefined,
  storyContext: ReducedStoryContext
) {
  const [transformedCode, setTransformedCode] = useState('Transforming...');

  const transformed = transform ? transform(source, storyContext) : source;
  const pendingTransform =
    typeof transformed === 'object' && typeof transformed.then === 'function'
      ? transformed
      : undefined;

  useEffect(() => {
    if (!pendingTransform) {
      return;
    }

    let cancelled = false;
    void pendingTransform.then((transformResult) => {
      if (!cancelled) {
        setTransformedCode((current) => (current === transformResult ? current : transformResult));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pendingTransform]);

  return typeof transformed === 'string' ? transformed : transformedCode;
}
