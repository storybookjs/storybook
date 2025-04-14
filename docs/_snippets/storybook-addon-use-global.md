```ts filename="src/withGlobals.ts" renderer="common" language="ts"
import type { Renderer, PartialStoryFn as StoryFunction, StoryContext } from '@storybook/types';

import { useEffect, useMemo, useGlobals } from '@storybook/preview-api';
import { PARAM_KEY } from './constants';

import { clearStyles, addOutlineStyles } from './helpers';

import outlineCSS from './outlineCSS';

export const withGlobals = (StoryFn: StoryFunction<Renderer>, context: StoryContext<Renderer>) => {
  const [globals] = useGlobals();

  const isActive = [true, 'true'].includes(globals[PARAM_KEY]);

  // Is the addon being used in the docs panel
  const isInDocs = context.viewMode === 'docs';

  const outlineStyles = useMemo(() => {
    const selector = isInDocs ? `#anchor--${context.id} .docs-story` : '.sb-show-main';

    return outlineCSS(selector);
  }, [context.id]);
  useEffect(() => {
    const selectorId = isInDocs ? `my-addon-docs-${context.id}` : `my-addon`;

    if (!isActive) {
      clearStyles(selectorId);
      return;
    }

    addOutlineStyles(selectorId, outlineStyles);

    return () => {
      clearStyles(selectorId);
    };
  }, [isActive, outlineStyles, context.id]);

  return StoryFn();
};
```
