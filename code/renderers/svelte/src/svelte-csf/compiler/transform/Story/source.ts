/**
 * WARN: This is likely to be revamped/removed, as it stands out from the CSF format.
 * Ref: https://github.com/storybookjs/addon-svelte-csf/pull/181#discussion_r1614834092
 *
 * TODO: If we decide to preserve this 'feature', then we can refactor this module.
 * For the time being in restoring this feature, I didn't see a good reason to deal with duplicate code.
 */
import { logger } from '@storybook/client-logger';
import type { ObjectExpression, Property, Statement } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';
import type { Attribute } from 'svelte/compiler';

import type { extractStoriesNodesFromExportDefaultFn } from '../../../parser/extract/compiled/stories.js';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../../parser/extract/svelte/Story/attributes.js';

interface Params {
  code: MagicString;
  nodes: {
    svelte: SvelteASTNodes['storyComponents'][number];
    compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
  };
  filename: string;
}

export function moveSourceAttributeToParameters(params: Params) {
  const { code, nodes, filename } = params;
  const { svelte, compiled } = nodes;
  const { component } = svelte;

  // @ts-expect-error FIXME: I know, I know... this doesn't exist in the `StoryObj` object.
  const { source }: { source: Attribute | undefined } = extractStoryAttributesNodes({
    component,
    // @ts-expect-error FIXME: I know, I know... this doesn't exist in the `StoryObj` object.
    attributes: ['source'],
  });

  if (!source) {
    return;
  }

  const { value } = source;

  if (value === true) {
    // TODO: Should we throw or just warn?
    logger.warn(`Invalid value for attribute 'source', expected string. Stories file: ${filename}`);
    return;
  }

  let rawSource: string;

  if (value[0].type === 'Text') {
    rawSource = value[0].data;
  } else if (
    value[0].type === 'ExpressionTag' &&
    value[0].expression.type === 'Literal' &&
    typeof value[0].expression.value === 'string'
  ) {
    rawSource = value[0].expression.value;
  } else {
    // TODO: Should we throw or just warn?
    logger.warn(`Invalid value for attribute 'source', expected string. Stories file: ${filename}`);
    return;
  }

  const compiledPropsObjectExpression = compiled.arguments[1];

  if (compiledPropsObjectExpression.type !== 'ObjectExpression') {
    throw new Error(`Invalid`);
  }

  const newCodeProperty = createProperty('code', {
    type: 'Literal',
    value: rawSource,
  });
  const newSourceProperty = createProperty('source', createObjectExpression([newCodeProperty]));
  const newDocsProperty = createProperty('docs', createObjectExpression([newSourceProperty]));
  const newParametersProperty = createProperty(
    'parameters',
    createObjectExpression([newDocsProperty])
  );

  const currentParametersPropertyIndex = findPropertyIndex(
    'parameters',
    compiledPropsObjectExpression
  );

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
    // TODO: Update error message
    throw new Error(`Invalid schema`);
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

  const currentDocsProperty = currentParametersProperty.value.properties[currentDocsPropertyIndex];

  if (
    currentDocsProperty.type !== 'Property' ||
    currentDocsProperty.value.type !== 'ObjectExpression'
  ) {
    // TODO: Update error message
    throw new Error(`Invalid schema`);
  }

  const currentSourcePropertyIndex = findPropertyIndex('source', currentDocsProperty.value);

  if (currentSourcePropertyIndex === -1) {
    currentDocsProperty.value.properties.push(newSourceProperty);
    currentParametersProperty.value.properties[currentDocsPropertyIndex] = currentDocsProperty;
    compiledPropsObjectExpression.properties[currentParametersPropertyIndex] =
      currentParametersProperty;
    compiled.arguments[1] = compiledPropsObjectExpression;

    return updateCompiledNode(code, compiled);
  }

  const currentSourceProperty = currentDocsProperty.value.properties[currentDocsPropertyIndex];

  if (
    currentSourceProperty.type !== 'Property' ||
    currentSourceProperty.value.type !== 'ObjectExpression'
  ) {
    // TODO: Update error message
    throw new Error(`Invalid schema`);
  }

  const currentCodePropertyIndex = findPropertyIndex('code', currentDocsProperty.value);

  if (currentCodePropertyIndex !== -1) {
    logger.warn(
      `<Story /> already has explictly set 'source' for the component in its parameters. Ignoring the 'source' prop. Stories file: ${filename}`
    );

    return;
  }

  currentSourceProperty.value.properties.push(newCodeProperty);
  currentDocsProperty.value.properties[currentSourcePropertyIndex] = currentDocsProperty;
  currentParametersProperty.value.properties[currentDocsPropertyIndex] = currentDocsProperty;
  compiledPropsObjectExpression.properties[currentParametersPropertyIndex] =
    currentParametersProperty;
  compiled.arguments[1] = compiledPropsObjectExpression;

  return updateCompiledNode(code, compiled);
}

function updateCompiledNode(code: MagicString, node: Params['nodes']['compiled']) {
  // @ts-expect-error FIXME: These keys exists at runtime, perhaps I missed some type extension from `svelte/compiler`?
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

function findPropertyIndex(name: string, node: ObjectExpression) {
  return node.properties.findIndex(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name
  );
}
