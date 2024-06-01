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

  const compiledPropsObjectExpression = compiled.arguments[1];

  if (compiledPropsObjectExpression.type !== 'ObjectExpression') {
    throw new Error(`Invalid`);
  }

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
    compiledPropsObjectExpression.properties.push(newParametersProperty);
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
  }

  const currentParametersProperty =
    compiledPropsObjectExpression.properties[currentParametersPropertyIndex];

  if (
    currentParametersProperty.type !== 'Property' ||
    currentParametersProperty.value.type !== 'ObjectExpression'
  ) {
    throw new Error();
  }

  const currentDocsPropertyIndex = findPropertyIndex(
    'docs',
    currentParametersProperty.value[0].expression
  );

  if (currentDocsPropertyIndex === -1) {
    currentParametersProperty.value.properties.push(newDocsProperty);
    compiledPropsObjectExpression.properties[currentParametersPropertyIndex] =
      currentParametersProperty;
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
  }

  const currentDocsProperty =
    currentParametersProperty.value[0].expression.properties[currentDocsPropertyIndex];

  if (
    currentDocsProperty.type !== 'Property' ||
    currentDocsProperty.value.type !== 'ObjectExpression'
  ) {
    throw new Error();
  }

  const currentDescriptionPropertyIndex = findPropertyIndex(
    'description',
    currentDocsProperty.value
  );

  if (currentDescriptionPropertyIndex === -1) {
    currentDocsProperty.value.properties.push(newDescriptionProperty);
    currentParametersProperty.value.properties[currentDocsPropertyIndex] = currentDocsProperty;
    compiledPropsObjectExpression.properties[currentParametersPropertyIndex] =
      currentParametersProperty;
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
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
  compiledPropsObjectExpression.properties[currentParametersPropertyIndex] =
    currentParametersProperty;
  compiled.arguments[1] = compiledPropsObjectExpression;

  return updateCompiledNode(code, compiled);
}

function updateCompiledNode(code: MagicString, node: Params['nodes']['compiled']) {
  // @ts-expect-error FIXME: These keys exists at runtime, perhaps I missed some type extension from `estree`?
  const { start, end } = node;

  code.update(
    start,
    end,
    toJs({
      type: 'Program',
      sourceType: 'module',
      body: [node as unknown as Statement],
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
