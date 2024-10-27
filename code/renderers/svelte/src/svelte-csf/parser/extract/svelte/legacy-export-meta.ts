import type { ObjectExpression, Property } from 'estree';

import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';
import type { CompiledASTNodes } from '#parser/extract/compiled/nodes';

import { GetDefineMetaFirstArgumentError } from '#utils/error/parser/extract/svelte';
import type { Cmp, Meta } from '#types';

interface Options<Properties extends Array<keyof Meta<Cmp>>> {
  nodes: SvelteASTNodes | CompiledASTNodes;
  properties: Properties;
  filename?: string;
}

type Result<Properties extends Array<keyof Meta<Cmp>>> = Partial<{
  [Key in Properties[number]]: Property;
}>;

/**
 * Extract selected properties from `defineMeta` as AST node {@link Property}.
 * It works for original svelte code as well as compiled code,
 * because in both cases, the AST structure is the same _(or should be!)_.
 */
export function extractLegacyExportMetaPropertiesNodes<
  const Properties extends Array<keyof Meta<Cmp>>,
>(options: Options<Properties>): Result<Properties> {
  const { properties } = options;
  const objectExpression = getLegacyExportMetaObjectExpression(options);
  const results: Result<Properties> = {};

  for (const property of objectExpression.properties) {
    if (
      property.type === 'Property' &&
      property.key.type === 'Identifier' &&
      properties.includes(property.key.name as Properties[number])
    ) {
      results[property.key.name] = property;
    }
  }

  return results;
}

/**
 * `defineMeta` accepts only one argument - an {@link ObjectExpression},
 * which should satisfy `@storybook/svelte`'s interface {@link Meta}.
 */
export function getLegacyExportMetaObjectExpression(
  options: Pick<Options<Array<keyof Meta<Cmp>>>, 'filename' | 'nodes'>
): ObjectExpression {
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

  throw new GetDefineMetaFirstArgumentError({
    filename,
    defineMetaVariableDeclaration,
  });
}
