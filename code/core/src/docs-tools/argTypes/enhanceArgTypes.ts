import type { Renderer, StoryContextForEnhancers } from 'storybook/internal/types';

import { combineParameters } from '../../preview-api/modules/store/parameters';

export const enhanceArgTypes = <TRenderer extends Renderer>(
  context: StoryContextForEnhancers<TRenderer>
) => {
  const {
    component,
    argTypes: userArgTypes,
    parameters: { docs = {} },
  } = context;
  const { extractArgTypes } = docs;

  if (!extractArgTypes || !component) {
    return userArgTypes;
  }

  const extractedArgTypes = extractArgTypes(component);
  return extractedArgTypes ? combineParameters(extractedArgTypes, userArgTypes) : userArgTypes;
};
