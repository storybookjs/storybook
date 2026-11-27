import { useEffect, useState } from 'react';

import { logger } from 'storybook/internal/client-logger';
import type { Args, StoryContext } from 'storybook/internal/csf';
import { hideArgTypes } from 'storybook/internal/docs-tools';

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

  let transformed: string | Promise<string> = source.code;
  let transformError: unknown;
  if (transform) {
    try {
      transformed = transform(source.code, hideArgTypes(storyContext as StoryContext));
    } catch (error) {
      transformError = error;
    }
  }

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

    if (transformError !== undefined) {
      logger.error(transformError);
    }

    if (typeof transformed === 'string') {
      complete(transformed);
    } else {
      transformed.then(complete, (error) => {
        if (active) {
          logger.error(error);
          complete(source.code);
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
