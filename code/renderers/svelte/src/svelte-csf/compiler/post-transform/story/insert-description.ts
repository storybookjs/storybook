import { logger } from '@storybook/node-logger';
import dedent from 'dedent';

import {
  findASTPropertyIndex,
  findPropertyDescriptionIndex,
  findPropertyDocsIndex,
  findPropertyParametersIndex,
  getParametersPropertyValue,
  getDocsPropertyValue,
  getDescriptionPropertyValue,
} from '#compiler/post-transform/shared/description';
import { createASTObjectExpression, createASTProperty } from '#parser/ast';

import type { extractStoriesNodesFromExportDefaultFn } from '#parser/extract/compiled/stories';
import { getStoryPropsObjectExpression } from '#parser/extract/compiled/story';
import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';
import type { Literal, Property } from 'estree';

interface Params {
  nodes: {
    svelte: SvelteASTNodes['storyComponents'][number];
    compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
  };
  filename?: string;
}

/**
 * Attempt to insert HTML comment above the `<Story />` component as a description **into the compiled code**.
 * If the user did explicitly set `parameters.docs.description.story` and the HTML comment exists, then it will log a warning.
 */
export function insertStoryHTMLCommentAsDescription(params: Params) {
  const { nodes, filename } = params;
  const { svelte, compiled } = nodes;
  const { comment, component } = svelte;

  if (!comment) {
    return;
  }

  const storyPropsObjectExpression = getStoryPropsObjectExpression({
    node: compiled,
    filename,
  });

  if (
    findPropertyParametersIndex({
      filename,
      component,
      node: storyPropsObjectExpression,
    }) === -1
  ) {
    storyPropsObjectExpression.properties.push(
      createASTProperty('parameters', createASTObjectExpression())
    );
  }

  if (
    findPropertyDocsIndex({
      filename,
      component,
      node: storyPropsObjectExpression,
    }) === -1
  ) {
    getParametersPropertyValue({
      filename,
      component,
      node: storyPropsObjectExpression,
    }).properties.push(createASTProperty('docs', createASTObjectExpression()));
  }

  if (
    findPropertyDescriptionIndex({
      filename,
      component,
      node: storyPropsObjectExpression,
    }) === -1
  ) {
    getDocsPropertyValue({
      filename,
      component,
      node: storyPropsObjectExpression,
    }).properties.push(createASTProperty('description', createASTObjectExpression()));
  }

  if (
    findASTPropertyIndex({
      filename,
      component,
      name: 'story',
      node: getDescriptionPropertyValue({
        filename,
        component,
        node: storyPropsObjectExpression,
      }),
    }) !== -1
  ) {
    const propertyName = storyPropsObjectExpression.properties.find(
      (p) => p.type === 'Property' && p.key.type === 'Literal' && p.key.value === 'name'
    ) as Property;
    const name = (propertyName.value as Literal).value;
    logger.warn(
      dedent`
        Svelte CSF:
          Description was already set in parameters.docs.description.story
          in the story: <Story name="${name}" />.
          ignoring JSDoc comment above.
          in:
          ${filename}`
    );

    return;
  }

  getDescriptionPropertyValue({
    filename,
    component,
    node: storyPropsObjectExpression,
  }).properties.push(
    createASTProperty('story', {
      type: 'Literal',
      value: dedent(comment.data),
    })
  );

  if (compiled.type === 'CallExpression') {
    compiled.arguments[1] === storyPropsObjectExpression;
  } else if (
    compiled.type === 'ExpressionStatement' &&
    compiled.expression.type === 'CallExpression'
  ) {
    compiled.expression.arguments[1] === storyPropsObjectExpression;
  }
}
