import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { ObjectExpression, Property, Statement } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';
import type { Comment, Component } from 'svelte/compiler';

import type { extractStoriesNodesFromExportDefaultFn } from '../../../parser/extract/compiled/stories.js';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';

interface Params {
  code: MagicString;
  nodes: {
    svelte: SvelteASTNodes['storyComponents'][number];
    compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
  };
  filename: string;
  originalCode: string;
}

export function updateCompiledStoryProps(params: Params) {
  const { code, nodes, filename, originalCode } = params;
  const { svelte, compiled } = nodes;
  const { component, comment } = svelte;

  const storyPropsObjectExpression = getStoryPropsObjectExpression(compiled);

  const findParametersIndex = () => findPropertyIndex('parameters', storyPropsObjectExpression);

  if (findParametersIndex() === -1) {
    storyPropsObjectExpression.properties.push(
      createProperty('parameters', createObjectExpression([]))
    );
  }

  const currentParametersProperty = storyPropsObjectExpression.properties[
    findParametersIndex()
  ] as Property;

  if (currentParametersProperty.value.type !== 'ObjectExpression') {
    throw new Error('Invalid schema');
  }

  const findDocsIndex = () =>
    findPropertyIndex('docs', currentParametersProperty.value as ObjectExpression);

  if (findDocsIndex() === -1) {
    currentParametersProperty.value.properties.push(
      createProperty('docs', createObjectExpression([]))
    );
  }

  const currentDocsProperty = currentParametersProperty.value.properties[
    findDocsIndex()
  ] as Property;

  if (currentDocsProperty.value.type !== 'ObjectExpression') {
    throw new Error('Invalid schema');
  }

  if (comment) {
    insertDescriptionStory({ comment, currentDocsProperty });
  }
  insertSourceCode({ component, currentDocsProperty, filename, originalCode });

  return updateCompiledNode({
    code,
    nodes,
    metaObjectExpression: storyPropsObjectExpression,
  });
}

function getStoryPropsObjectExpression(
  node: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number]
): ObjectExpression {
  if (node.type === 'CallExpression' && node.arguments[1].type === 'ObjectExpression') {
    return node.arguments[1];
  }

  if (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' &&
    node.expression.arguments[1].type === 'ObjectExpression'
  ) {
    return node.expression.arguments[1];
  }

  throw new Error('Internal error in attempt to extract meta as object expression.');
}

function updateCompiledNode({
  code,
  nodes,
  metaObjectExpression,
}: {
  code: Params['code'];
  nodes: Params['nodes'];
  metaObjectExpression: ObjectExpression;
}) {
  const { compiled } = nodes;

  if (compiled.type === 'CallExpression') {
    compiled.arguments[1] === metaObjectExpression;
  }

  if (compiled.type === 'ExpressionStatement' && compiled.expression.type === 'CallExpression') {
    compiled.expression.arguments[1] === metaObjectExpression;
  }

  // @ts-expect-error FIXME: These keys exists at runtime, perhaps I missed some type extension from `estree`?
  const { start, end } = compiled;

  code.update(
    start,
    end,
    toJs({
      type: 'Program',
      sourceType: 'module',
      body: [compiled as unknown as Statement],
    }).value
  );
}

function createProperty(name: string, value: Property['value']): Property {
  return {
    type: 'Property',
    kind: 'init',
    computed: false,
    method: false,
    shorthand: false,
    key: {
      type: 'Identifier',
      name,
    },
    value,
  };
}

function createObjectExpression(properties: Property[]): ObjectExpression {
  return {
    type: 'ObjectExpression',
    properties,
  };
}

function findPropertyIndex(name: string, node: ObjectExpression) {
  return node.properties.findIndex(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
  );
}

function insertDescriptionStory({
  comment,
  currentDocsProperty,
  filename,
}: {
  comment: Comment;
  currentDocsProperty: Property;
  filename?: string;
}) {
  if (currentDocsProperty.value.type !== 'ObjectExpression') {
    // TODO: Update error message
    throw new Error('Invalid schema');
  }

  const findDescriptionIndex = () =>
    findPropertyIndex('description', currentDocsProperty.value as ObjectExpression);

  if (findDescriptionIndex() === -1) {
    currentDocsProperty.value.properties.push(
      createProperty('description', createObjectExpression([]))
    );
  }

  const currentDescriptionProperty = currentDocsProperty.value.properties[
    findDescriptionIndex()
  ] as Property;

  if (currentDescriptionProperty.value.type !== 'ObjectExpression') {
    // TODO: Update error message
    throw new Error('Invalid schema');
  }

  const findStoryIndexIndex = () =>
    findPropertyIndex('story', currentDescriptionProperty.value as ObjectExpression);

  if (findStoryIndexIndex() !== -1) {
    logger.warn(
      `One of <Story /> component(s) already has explictly set description. Ignoring the HTML comment above. Stories file: ${filename}`
    );

    return;
  }

  currentDescriptionProperty.value.properties.push(
    createProperty('story', {
      type: 'Literal',
      value: dedent(comment.data),
    })
  );

  currentDocsProperty.value.properties[findDescriptionIndex()] = currentDescriptionProperty;
}

function insertSourceCode({
  component,
  currentDocsProperty,
  filename,
  originalCode,
}: {
  component: Component;
  currentDocsProperty: Property;
  filename?: string;
  originalCode: string;
}) {
  if (currentDocsProperty.value.type !== 'ObjectExpression') {
    // TODO: Update error message
    throw new Error('Invalid schema');
  }

  const findSourceIndex = () =>
    findPropertyIndex('source', currentDocsProperty.value as ObjectExpression);

  if (findSourceIndex() === -1) {
    currentDocsProperty.value.properties.push(createProperty('source', createObjectExpression([])));
  }

  const currentSourceProperty = currentDocsProperty.value.properties[findSourceIndex()] as Property;

  if (currentSourceProperty.value.type !== 'ObjectExpression') {
    // TODO: Update error message
    throw new Error('Invalid schema');
  }

  const findStoryIndex = () =>
    findPropertyIndex('story', currentSourceProperty.value as ObjectExpression);

  if (findStoryIndex() !== -1) {
    // TODO: That's not unepected, curious or anything. No need for a warning, right?
    return;
  }

  const { fragment, start, end } = component;
  // TODO: From there we need to start the logic for filling Story's children raw source.
  // Temporarily used the whole raw soure fragment.
  const { nodes } = fragment;
  const codeValue = originalCode.slice(start, end);

  currentSourceProperty.value.properties.push(
    createProperty('code', {
      type: 'Literal',
      value: codeValue,
    })
  );

  currentDocsProperty.value.properties[findStoryIndex()] = currentSourceProperty;
}
