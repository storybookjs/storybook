import type { Meta } from '@storybook/svelte';
import type { ObjectExpression, Property } from 'estree';
import type { SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import type { SvelteASTNodes } from '../../extract-ast-nodes.js';

interface Options<Properties extends Array<keyof Meta>> {
  nodes: SvelteASTNodes;
  filename: string;
  properties: Properties;
}

type Result<Properties extends Array<keyof Meta>> = Partial<{
  [Key in Properties[number]]: Property;
}>;

export async function extractMetaPropertiesNodes<const Properties extends Array<keyof Meta>>(
  options: Options<Properties>
): Promise<Result<Properties>> {
  const { walk } = await import('zimmerframe');

  const { properties } = options;
  const objectExpression = getFirstArgumentObjectExpression(options);
  const state: Result<Properties> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    Property(node, { state }) {
      if (
        node.key.type === 'Identifier' &&
        properties.includes(node.key.name as Properties[number])
      ) {
        state[node.key.name] = node;
      }
    },
  };

  walk(objectExpression, state, visitors);

  return state;
}

function getFirstArgumentObjectExpression(options: Options<Array<keyof Meta>>): ObjectExpression {
  const { nodes, filename } = options;
  const { defineMetaVariableDeclaration, defineMetaImport } = nodes;
  const { declarations } = defineMetaVariableDeclaration;
  const declaration = declarations[0];
  const { init } = declaration;

  if (
    init?.type === 'CallExpression' &&
    init.callee.type === 'Identifier' &&
    init.callee.name === defineMetaImport.local.name && // NOTE: the callee.name could be renamed by user
    init.arguments.length === 1 &&
    init.arguments[0].type === 'ObjectExpression'
  ) {
    return init.arguments[0];
  }

  throw new Error(
    `Internal error while trying to get first argument from defineMeta in stories file: ${filename}.`
  );
}
