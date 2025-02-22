import type { Args, StoryContext } from '@storybook/csf';

import { useEffect, useMemo, useState } from '../addons';

type ReducedStoryContext = Omit<
  StoryContext<any, Args>,
  'abortSignal' | 'canvasElement' | 'step' | 'context'
>;

type Transformer =
  | ((code: string, storyContext: ReducedStoryContext) => string | Promise<string>)
  | undefined;

export function useTransformCode(source: string | undefined, context: ReducedStoryContext) {
  const [transformedCode, setTransformedCode] = useState<string | undefined>('Transforming...');
  const transform = context.parameters?.docs?.source?.transform as Transformer;

  const transformed = transform && source ? transform?.(source, context) : source;

  useEffect(() => {
    async function getTransformedCode() {
      const result = transformed ? await transformed : undefined;
      if (result != transformedCode) {
        console.log({ result, transformedCode });
        setTransformedCode(result);
      }
    }

    getTransformedCode();
  });

  if (typeof transformed === 'object' && typeof transformed.then === 'function') {
    return transformedCode;
  }

  return (transformed as string) ?? '';
}
