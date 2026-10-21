import type { BeforeEach } from 'storybook/internal/types';

import { PARAM_KEY } from './constants.ts';
import { addOutlineStyles, clearStyles } from './helpers.ts';
import outlineCSS from './outlineCSS.ts';

// Runs before every render of a story, also of one that runs no decorators, and leaves nothing
// once the story is left.
export const applyOutline: BeforeEach = (context) => {
  const globals = context.globals || {};
  const isDisabled = context.parameters?.[PARAM_KEY]?.disable;
  const isActive = !isDisabled && [true, 'true'].includes(globals[PARAM_KEY]);
  const isInDocs = context.viewMode === 'docs';
  const selectorId = isInDocs ? `addon-outline-docs-${context.id}` : `addon-outline`;

  if (!isActive) {
    clearStyles(selectorId);
    return;
  }

  // A story with layout 'document' owns the body, whichever body the document has.
  const selector = isInDocs
    ? `[data-story-block="true"]`
    : context.parameters?.layout === 'document'
      ? 'body'
      : '.sb-show-main';

  addOutlineStyles(selectorId, outlineCSS(selector));

  return () => {
    clearStyles(selectorId);
  };
};
