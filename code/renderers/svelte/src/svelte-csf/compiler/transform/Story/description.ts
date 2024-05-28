import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { ObjectExpression, Property, Statement } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';
import type { Component } from 'svelte/compiler';

import type { SvelteASTNodes } from '../../../utils/parser/extract/svelte/nodes.js';
import type { extractStoriesNodesFromExportDefaultFn } from '../../../utils/parser/extract/compiled/stories.js';

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

  if (!svelte) {
    throw new Error('svelte was undefined!' + filename);
  }
  const { component, comment } = svelte;

  if (!comment) {
    return;
  }

  const compiledPropsObjectExpression = compiled.arguments[1];

  if (compiledPropsObjectExpression.type !== 'ObjectExpression') {
    throw new Error(`Invalid`);
  }

  const componentProperty = createProperty('component', {
    type: 'Literal',
    value: dedent(comment.data),
  });
  const descriptionProperty = createProperty(
    'description',
    createObjectExpression([componentProperty])
  );
  const docsProperty = createProperty('docs', createObjectExpression([descriptionProperty]));
  const parametersAttribute = createProperty('parameters', createObjectExpression([docsProperty]));

  const parametersIndex = findAttributeIndex('parameters', component);

  if (parametersIndex === -1) {
    compiledPropsObjectExpression.properties.push(parametersAttribute);
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
  }

  const parameters = compiledPropsObjectExpression.properties[parametersIndex];

  if (parameters.type !== 'Property' || parameters.value.type !== 'ObjectExpression') {
    throw new Error();
  }

  const docsIndex = findPropertyIndex('docs', parameters.value[0].expression);

  if (docsIndex === -1) {
    parameters.value.properties.push(docsProperty);
    compiledPropsObjectExpression.properties[parametersIndex] = parameters;
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
  }

  const docs = parameters.value[0].expression.properties[docsIndex];

  if (docs.type !== 'Property' || docs.value.type !== 'ObjectExpression') {
    throw new Error();
  }

  const descriptionIndex = findPropertyIndex('description', docs.value);

  if (descriptionIndex === -1) {
    docs.value.properties.push(descriptionProperty);
    parameters.value.properties[docsIndex] = docs;
    compiledPropsObjectExpression.properties[parametersIndex] = parameters;
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
  }

  const description = docs.value.properties[descriptionIndex];

  if (description.type !== 'Property' || description.value.type !== 'ObjectExpression') {
    throw new Error();
  }

  const componentIndex = findPropertyIndex('component', description.value);

  if (componentIndex !== -1) {
    logger.warn(
      `defineMeta() already has explictly set description. Ignoring the JSDoc comment above. Stories file: ${filename}`
    );

    return;
  }

  description.value.properties.push(componentProperty);
  docs.value.properties[descriptionIndex] = description;
  parameters.value.properties[docsIndex] = docs;
  compiledPropsObjectExpression.properties[parametersIndex] = parameters;
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
