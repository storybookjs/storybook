import { unwrapExpression } from 'storybook/internal/csf-tools';

import type { ESTreeAST } from '../../ast.ts';
import type { SvelteASTNodes } from './nodes.ts';
import { isOneOf } from '../../../utils/is-one-of.ts';
import { skipTypeCalls } from '../../../utils/import-source.ts';
import type { CompiledASTNodes } from '../compiled/nodes.ts';

import { GetDefineMetaFirstArgumentError } from '../../../utils/error/parser/extract/svelte.ts';
import type { Cmp, ComponentAnnotations } from '../../../types.ts';

interface Options<Properties extends Array<keyof ComponentAnnotations<Cmp>>> {
  nodes: SvelteASTNodes | CompiledASTNodes;
  properties: Properties;
  filename?: string;
}

type Result<Properties extends Array<keyof ComponentAnnotations<Cmp>>> = Partial<{
  [Key in Properties[number]]: ESTreeAST.Property;
}>;

// Works on both the Svelte and the compiled AST, because `defineMeta()` has the same shape in both.
export function extractDefineMetaPropertiesNodes<
  const Properties extends Array<keyof ComponentAnnotations<Cmp>>,
>(options: Options<Properties>): Result<Properties> {
  const { properties } = options;
  const objectExpression = getDefineMetaFirstArgumentObjectExpression(options);
  const results: Result<Properties> = {};

  for (const property of objectExpression.properties) {
    if (
      property.type === 'Property' &&
      property.key.type === 'Identifier' &&
      isOneOf<Properties[number]>(properties, property.key.name)
    ) {
      results[property.key.name] = property;
    }
  }

  return results;
}

export function getDefineMetaFirstArgumentObjectExpression(
  options: Pick<Options<Array<keyof ComponentAnnotations<Cmp>>>, 'filename' | 'nodes'>
): ESTreeAST.ObjectExpression {
  const { nodes, filename } = options;
  const { defineMetaVariableDeclaration } = nodes;
  const { declarations } = defineMetaVariableDeclaration;
  const declaration = declarations[0];
  const init = declaration.init && skipTypeCalls(declaration.init);
  const argument =
    init?.type === 'CallExpression' && init.arguments.length === 1
      ? unwrapExpression(init.arguments[0])
      : undefined;

  if (argument?.type === 'ObjectExpression') {
    return argument;
  }

  throw new GetDefineMetaFirstArgumentError(filename);
}
