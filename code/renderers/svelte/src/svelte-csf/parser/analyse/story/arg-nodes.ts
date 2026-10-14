import { parser, recast, types as t } from 'storybook/internal/babel';
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
 * of the story, as babel parses their code. An arg whose code is not known here is left out: any
 * arg written before a spread, a method or a computed key, which may set it, and every arg when
 * `args` is not an object literal, such as `args={storyArgs}`.
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
  let nodes: Record<string, t.Node> = {};
  for (const written of [metaArgs, storyArgs]) {
    const { start, end } = (written ?? {}) as { start?: number; end?: number };
    if (start === undefined || end === undefined) {
      continue;
    }
    const [statement] = parse(`(${originalCode.slice(start, end)})`).program.body;
    const object = t.isExpressionStatement(statement)
      ? unwrapExpression(statement.expression)
      : undefined;
    for (const property of t.isObjectExpression(object) ? object.properties : [undefined]) {
      const name =
        t.isObjectProperty(property) && !property.computed
          ? t.isIdentifier(property.key)
            ? property.key.name
            : t.isStringLiteral(property.key)
              ? property.key.value
              : undefined
          : undefined;
      if (name === undefined) {
        // It may set any arg written before it.
        nodes = {};
      } else {
        nodes[name] = (property as t.ObjectProperty).value;
      }
    }
  }
  return nodes;
}

// Parsed as TypeScript without JSX, as a `.svelte` script is written, so `<number>x` is a cast.
const parse = (code: string): t.File =>
  recast.parse(code, {
    parser: {
      parse: (source: string) =>
        parser.parse(source, { sourceType: 'module', plugins: ['typescript'], tokens: true }),
    },
  });
