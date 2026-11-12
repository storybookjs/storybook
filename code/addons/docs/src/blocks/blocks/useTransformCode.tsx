import { useEffect, useState } from 'react';

import type { Args, StoryContext } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/client-logger';

import type { SourceItem } from './SourceContainer.tsx';

type ReducedStoryContext = Omit<
  StoryContext<any, Args>,
  'abortSignal' | 'canvasElement' | 'step' | 'context'
>;

type TransformedSource = Pick<SourceItem, 'code' | 'language'>;

export function useTransformCode(
  source: TransformedSource,
  transform:
    | ((code: string, storyContext: ReducedStoryContext) => string | Promise<string>)
    | undefined,
  storyContext: ReducedStoryContext
): TransformedSource {
  const [completedSource, setCompletedSource] = useState<TransformedSource>({
    code: 'Transforming...',
  });
  const transformed = transform ? transform(source.code, storyContext) : source.code;

  useEffect(() => {
    let active = true;
    const complete = (code: string) => {
      if (active) {
        setCompletedSource((current) =>
          current.code === code && current.language === source.language
            ? current
            : { code, language: source.language }
        );
      }
    };

    if (typeof transformed === 'string') {
      complete(transformed);
    } else {
      transformed.then(complete, (error) => {
        if (active) {
          logger.error(error);
        }
      });
    }

    return () => {
      active = false;
    };
  });

  return typeof transformed === 'string'
    ? { code: transformed, language: source.language }
    : completedSource;
}
