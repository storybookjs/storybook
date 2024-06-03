import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { ObjectExpression, Property, Statement } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';
import type { Component } from 'svelte/compiler';

import type { extractStoriesNodesFromExportDefaultFn } from '../../../parser/extract/compiled/stories.js';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';

interface Params {
  code: MagicString;
  nodes: {
    svelte: SvelteASTNodes['storyComponents'][number];
    compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
  };
  filename: string;
}

export function insertStoryHTMLCommentAsDescription(params: Params) {
  const { code, nodes, filename } = params;
  const { svelte, compiled } = nodes;
  const { component, comment } = svelte;

  if (!comment) {
    return;
  }

  const metaObjectExpression = getMetaObjectExpression(compiled);

  const newStoryProperty = createProperty('story', {
    type: 'Literal',
    value: dedent(comment.data),
  });
  const newDescriptionProperty = createProperty(
    'description',
    createObjectExpression([newStoryProperty])
  );
  const newDocsProperty = createProperty('docs', createObjectExpression([newDescriptionProperty]));
  const newParametersProperty = createProperty(
    'parameters',
    createObjectExpression([newDocsProperty])
  );

  const currentParametersPropertyIndex = findAttributeIndex('parameters', component);

  if (currentParametersPropertyIndex === -1) {
    metaObjectExpression.properties.push(newParametersProperty);

    return updateCompiledNode({ code, nodes, metaObjectExpression });
  }

  const currentParametersProperty = metaObjectExpression.properties[currentParametersPropertyIndex];

  if (
    currentParametersProperty.type !== 'Property' ||
    currentParametersProperty.value.type !== 'ObjectExpression'
  ) {
    // TODO: Update error message
    throw new Error();
  }

  const currentDocsPropertyIndex = findPropertyIndex(
    'docs',
    currentParametersProperty.value[0].expression
  );

  if (currentDocsPropertyIndex === -1) {
    currentParametersProperty.value.properties.push(newDocsProperty);
    metaObjectExpression.properties[currentParametersPropertyIndex] = currentParametersProperty;

    return updateCompiledNode({ code, nodes, metaObjectExpression });
  }

  const currentDocsProperty =
    currentParametersProperty.value[0].expression.properties[currentDocsPropertyIndex];

  if (
    currentDocsProperty.type !== 'Property' ||
    currentDocsProperty.value.type !== 'ObjectExpression'
  ) {
    // TODO: Update error message
    throw new Error();
  }

  const currentDescriptionPropertyIndex = findPropertyIndex(
    'description',
    currentDocsProperty.value
  );

  if (currentDescriptionPropertyIndex === -1) {
    currentDocsProperty.value.properties.push(newDescriptionProperty);
    currentParametersProperty.value.properties[currentDocsPropertyIndex] = currentDocsProperty;
    metaObjectExpression.properties[currentParametersPropertyIndex] = currentParametersProperty;

    return updateCompiledNode({ code, nodes, metaObjectExpression });
  }

  const currentDescriptionProperty =
    currentDocsProperty.value.properties[currentDescriptionPropertyIndex];

  if (
    currentDescriptionProperty.type !== 'Property' ||
    currentDescriptionProperty.value.type !== 'ObjectExpression'
  ) {
    throw new Error();
  }

  const currentStoryPropertyIndex = findPropertyIndex('story', currentDescriptionProperty.value);

  if (currentStoryPropertyIndex !== -1) {
    logger.warn(
      `<Story /> already has explictly set description. Ignoring the HTML comment above. Stories file: ${filename}`
    );

    return;
  }

  currentDescriptionProperty.value.properties.push(newStoryProperty);
  currentDocsProperty.value.properties[currentDescriptionPropertyIndex] =
    currentDescriptionProperty;
  currentParametersProperty.value.properties[currentDocsPropertyIndex] = currentDocsProperty;
  metaObjectExpression.properties[currentParametersPropertyIndex] = currentParametersProperty;

  return updateCompiledNode({ code, nodes, metaObjectExpression });
}

function getMetaObjectExpression(node: Params['nodes']['compiled']): ObjectExpression {
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

interface UpdateCompiledNode extends Pick<Params, 'code' | 'nodes'> {
  metaObjectExpression: ObjectExpression;
}

function updateCompiledNode(params: UpdateCompiledNode) {
  const { code, nodes, metaObjectExpression } = params;
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

function findAttributeIndex(name: string, node: Component) {
  return node.attributes.findIndex((a) => a.type === 'Attribute' && a.name === name);
}

function findPropertyIndex(name: string, node: ObjectExpression) {
  return node.properties.findIndex(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
  );
}
