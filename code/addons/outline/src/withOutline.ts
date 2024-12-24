import { useEffect, useMemo } from 'storybook/internal/preview-api';
import type {
  Renderer,
  StoryContext,
  PartialStoryFn as StoryFunction,
} from 'storybook/internal/types';

import { PARAM_KEY } from './constants';
import { addOutlineStyles, clearStyles } from './helpers';
import outlineCSS from './outlineCSS';

export const withOutline = (StoryFn: StoryFunction<Renderer>, context: StoryContext<Renderer>) => {
  const { globals } = context;
  const isActive = [true, 'true'].includes(globals[PARAM_KEY]);
  const isInDocs = context.viewMode === 'docs';

  const outlineStyles = useMemo(() => {
    const selector = isInDocs ? `[data-story-block="true"]` : '.sb-show-main';

    return outlineCSS(selector);
  }, [context]);

  useEffect(() => {
    const selectorId = isInDocs ? `addon-outline-docs-${context.id}` : `addon-outline`;

    if (!isActive) {
      clearStyles(selectorId);
    } else {
      addOutlineStyles(selectorId, outlineStyles);
    }

    return () => {
      clearStyles(selectorId);
    };
  }, [isActive, outlineStyles, context]);

  return StoryFn();
};
