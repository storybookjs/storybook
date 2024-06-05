import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { Property, ObjectExpression } from 'estree';
import type { Comment } from 'svelte/compiler';

import { createASTObjectExpression, createASTProperty, findASTPropertyIndex } from './shared.js';

interface Params {
  comment: Comment;
  currentDocsProperty: Property;
  filename?: string;
}

/**
 * Continue to "walking" through the AST node of `parameters.docs` {@link ObjectExpression},
 * to see if the user has explicitly set a `description.story`.
 * If the user did explictly set, it will log a warning,
 * otherwise insert nested  propertiesto the current ObjectExpression.
 * And the `description` is extracted from the existing HTML comment above the `<Story />` component.
 */
export function insertDescriptionStory(params: Params) {
  const { comment, currentDocsProperty, filename } = params;

  if (currentDocsProperty.value.type !== 'ObjectExpression') {
    throw new Error(
      `Invalid schema for property "docs" value - expected "ObjectExpression", but got ${currentDocsProperty.value.type}. Stories file: ${filename}`
    );
  }

  // Will need to check twice, because of scenario:
  // Index of the AST property was not found - then we create o new AST property.
  // After that, we need to check again to get the index of newly created AST node - property.
  const findDescriptionASTPropertyIndex = () =>
    findASTPropertyIndex('description', currentDocsProperty.value as ObjectExpression);

  if (findDescriptionASTPropertyIndex() === -1) {
    currentDocsProperty.value.properties.push(
      createASTProperty('description', createASTObjectExpression())
    );
  }

  const currentDescriptionProperty = currentDocsProperty.value.properties[
    findDescriptionASTPropertyIndex()
  ] as Property;

  if (currentDescriptionProperty.value.type !== 'ObjectExpression') {
    throw new Error(
      `Invalid schema for property "description" value - expected "ObjectExpression", but got ${currentDescriptionProperty.value.type}. Stories file: ${filename}`
    );
  }

  // Will need to check twice, because of scenario:
  // Index of the AST property was not found - thwn we create o new AST property.
  // After that, we need to check again to get the index of newly created AST node - property.
  const findStoryIndexIndex = () =>
    findASTPropertyIndex('story', currentDescriptionProperty.value as ObjectExpression);

  if (findStoryIndexIndex() !== -1) {
    logger.warn(
      `One of <Story /> component(s) already has explictly set description. Ignoring the HTML comment above. Stories file: ${filename}`
    );

    return;
  }

  currentDescriptionProperty.value.properties.push(
    createASTProperty('story', {
      type: 'Literal',
      value: dedent(comment.data),
    })
  );

  currentDocsProperty.value.properties[findDescriptionASTPropertyIndex()] =
    currentDescriptionProperty;
}
