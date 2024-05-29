import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import { toJs } from 'estree-util-to-js';
import type { ObjectExpression, Property } from 'estree';
import type MagicString from 'magic-string';

import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';
import type { CompiledASTNodes } from '../../../parser/extract/compiled/nodes.js';

interface Params {
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename: string;
}

export function insertDefineMetaJSDocCommentAsDescription(params: Params) {
  const { code, nodes, filename } = params;
  const { compiled, svelte } = nodes;
  const { defineMetaVariableDeclaration, defineMetaImport } = compiled;
  const { declarations } = defineMetaVariableDeclaration;
  // WARN: I had to provide Svelte AST nodes, because `Rollup.parse()` doesn't provide `leadingComments`.
  const { leadingComments } = svelte.defineMetaVariableDeclaration;

  if (!leadingComments) {
    return;
  }

  const declaration = declarations[0];
  const { init: defineMetaCall } = declaration;

  if (
    defineMetaCall?.type !== 'CallExpression' ||
    defineMetaCall.callee.type !== 'Identifier' ||
    defineMetaCall.callee.name !== defineMetaImport.local.name || // NOTE: the callee.name could be renamed by user
    defineMetaCall.arguments.length !== 1 ||
    defineMetaCall.arguments[0].type !== 'ObjectExpression'
  ) {
    throw new Error();
  }

  const parametersIndex = findPropertyIndex('parameters', defineMetaCall.arguments[0]);

  const componentProperty = createProperty('component', {
    type: 'Literal',
    value: dedent(leadingComments[0].value.replaceAll(/^ *\*/gm, '')),
  });
  const descriptionProperty = createProperty(
    'description',
    createObjectExpression([componentProperty])
  );
  const docsProperty = createProperty('docs', createObjectExpression([descriptionProperty]));
  const parametersProperty = createProperty('parameters', createObjectExpression([docsProperty]));

  if (parametersIndex === -1) {
    defineMetaCall.arguments[0].properties.push(parametersProperty);
    defineMetaVariableDeclaration.declarations[0].init = defineMetaCall;

    return updateNode(code, defineMetaVariableDeclaration);
  }

  const parameters = defineMetaCall.arguments[0].properties[parametersIndex];

  if (parameters.type !== 'Property' || parameters.value.type !== 'ObjectExpression') {
    throw new Error();
  }

  const docsIndex = findPropertyIndex('docs', parameters.value);

  if (docsIndex === -1) {
    parameters.value.properties.push(docsProperty);
    defineMetaCall.arguments[0].properties[parametersIndex] = parameters;
    defineMetaVariableDeclaration.declarations[0].init = defineMetaCall;

    return updateNode(code, defineMetaVariableDeclaration);
  }

  const docs = parameters.value.properties[docsIndex];

  if (docs.type !== 'Property' || docs.value.type !== 'ObjectExpression') {
    throw new Error();
  }

  const descriptionIndex = findPropertyIndex('description', docs.value);

  if (descriptionIndex === -1) {
    docs.value.properties.push(descriptionProperty);
    parameters.value.properties[docsIndex] = docs;
    defineMetaCall.arguments[0].properties[parametersIndex] = parameters;
    defineMetaVariableDeclaration.declarations[0].init = defineMetaCall;

    return updateNode(code, defineMetaVariableDeclaration);
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
  defineMetaCall.arguments[0].properties[parametersIndex] = parameters;
  defineMetaVariableDeclaration.declarations[0].init = defineMetaCall;

  return updateNode(code, defineMetaVariableDeclaration);
}

function updateNode(code: MagicString, node: SvelteASTNodes['defineMetaVariableDeclaration']) {
  // @ts-expect-error FIXME: Not sure if there are estree types which has start/end as number. Those values exist at runtime
  const { start, end } = node;

  code.update(
    start,
    end,
    toJs({
      type: 'Program',
      sourceType: 'module',
      body: [node],
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
