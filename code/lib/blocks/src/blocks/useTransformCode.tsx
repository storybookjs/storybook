import { useEffect, useState } from 'react';

import type { Args, StoryContext } from '@storybook/csf';

type ReducedStoryContext = Omit<
  StoryContext<any, Args>,
  'abortSignal' | 'canvasElement' | 'step' | 'context'
>;

export function useTransformCode(
  source: string,
  transform: (code: string, storyContext: ReducedStoryContext) => string | Promise<string>,
  storyContext: ReducedStoryContext
) {
  const [transformedCode, setTransformedCode] = useState('Transforming...');

  const transformed = transform ? transform?.(source, storyContext) : source;

  useEffect(() => {
    async function getTransformedCode() {
      const transformResult = await transformed;
      if (transformResult !== transformedCode) {
        console.log('setTransformedCode');
        setTransformedCode(transformResult);
      }
    }

    console.log('useEffect of transformCode');

    getTransformedCode();
  });

  if (typeof transformed === 'object' && typeof transformed.then === 'function') {
    return transformedCode;
  }

  return transformed as string;
}
