import type { Renderer, StoryContextForEnhancers } from '@storybook/core/types';
import { combineParameters } from '@storybook/core/preview-api';

export const enhanceArgTypes = <TRenderer extends Renderer>(
  context: StoryContextForEnhancers<TRenderer>
) => {
  const {
    component,
    argTypes: userArgTypes,
    parameters: { docs = {} },
  } = context;
  const { extractArgTypes } = docs;

  const extractedArgTypes = extractArgTypes && component ? extractArgTypes(component) : {};
  const withExtractedTypes = extractedArgTypes
    ? (combineParameters(extractedArgTypes, userArgTypes) as typeof userArgTypes)
    : userArgTypes;

  return withExtractedTypes;
};
