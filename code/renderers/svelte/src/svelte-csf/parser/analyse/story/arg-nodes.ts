import { babelParse, types as t } from 'storybook/internal/babel';
import { unwrapExpression } from 'storybook/internal/csf-tools';

import type { ESTreeAST, SvelteAST } from '../../ast.ts';
import { extractStoryAttributesNodes } from '../../extract/svelte/story/attributes.ts';

interface Params {
  component: SvelteAST.Component;
  defineMeta: ESTreeAST.VariableDeclaration;
  originalCode: string;
}

/**
 * The node each arg of a `<Story>` is written with, read from the `args` of `defineMeta` and then
 * of the story, as babel parses their code. An arg a spread may set is left out, as its code is not
 * known here.
 */
export function getStoryArgNodes({ component, defineMeta, originalCode }: Params) {
  const init = defineMeta.declarations[0]?.init;
  const metaObject = init?.type === 'CallExpression' ? init.arguments[0] : undefined;
  const metaArgs =
    metaObject?.type === 'ObjectExpression'
      ? metaObject.properties.find(
          (property): property is ESTreeAST.Property =>
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'args'
        )?.value
      : undefined;
  const { args } = extractStoryAttributesNodes({ component, attributes: ['args'] });
  const value = Array.isArray(args?.value) ? args.value[0] : args?.value;
  const storyArgs =
    value && value !== true && value.type === 'ExpressionTag' ? value.expression : undefined;
  const nodes: Record<string, t.Node> = {};
  for (const written of [metaArgs, storyArgs]) {
    const { start, end } = (written ?? {}) as { start?: number; end?: number };
    if (start === undefined || end === undefined) {
      continue;
    }
    const [statement] = babelParse(`(${originalCode.slice(start, end)})`).program.body;
    const object = t.isExpressionStatement(statement)
      ? unwrapExpression(statement.expression)
      : undefined;
    if (!t.isObjectExpression(object)) {
      continue;
    }
    for (const property of object.properties) {
      if (t.isSpreadElement(property)) {
        // A spread may set any arg written before it.
        for (const name of Object.keys(nodes)) {
          delete nodes[name];
        }
      } else if (t.isObjectProperty(property) && !property.computed) {
        const { key } = property;
        const name = t.isIdentifier(key)
          ? key.name
          : t.isStringLiteral(key)
            ? key.value
            : undefined;
        if (name !== undefined) {
          nodes[name] = property.value;
        }
      }
    }
  }
  return nodes;
}
