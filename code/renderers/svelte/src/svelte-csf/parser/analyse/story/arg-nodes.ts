import {
  type ESTreeNode,
  parseModule,
  staticKey,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import type { ESTreeAST, SvelteAST } from '../../ast.ts';
import { extractStoryAttributesNodes } from '../../extract/svelte/story/attributes.ts';

interface Params {
  /** The `<Story>` and the stories it extends, nearest first, whose args it merges in turn. */
  stories: SvelteAST.Component[];
  defineMeta: ESTreeAST.VariableDeclaration;
  originalCode: string;
}

/**
 * The node each arg of a `<Story>` is written with, read from the `args` of `defineMeta` and then
 * of each story, from the one extended furthest to the story itself, as oxc parses their code. An
 * arg whose code is not known here is left out: any arg written before a spread, a method or a
 * computed key, which may set it, and every arg when `args` is not an object literal, such as
 * `args={storyArgs}`.
 */
export function getStoryArgNodes({ stories, defineMeta, originalCode }: Params) {
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
  const storyArgs = [...stories].reverse().map((component) => {
    const { args } = extractStoryAttributesNodes({ component, attributes: ['args'] });
    const value = Array.isArray(args?.value) ? args.value[0] : args?.value;
    return value && value !== true && value.type === 'ExpressionTag' ? value.expression : undefined;
  });
  let nodes: Record<string, ESTreeNode> = {};
  for (const written of [metaArgs, ...storyArgs]) {
    const { start, end } = (written ?? {}) as { start?: number; end?: number };
    if (start === undefined || end === undefined) {
      continue;
    }
    // Parsed as TypeScript without JSX, as a `.svelte` script is written, so `<number>x` is a cast.
    // Behind the indentation of its first line, so a value spanning lines dedents as in the file.
    const indent = /^[ \t]*/.exec(
      originalCode.slice(originalCode.lastIndexOf('\n', start - 1) + 1)
    )![0];
    const [statement] = parseModule(`${indent}(${originalCode.slice(start, end)})`, 'args.ts')
      .program.body;
    const object =
      statement?.type === 'ExpressionStatement'
        ? unwrapExpression(statement.expression)
        : undefined;
    for (const property of object?.type === 'ObjectExpression' ? object.properties : [undefined]) {
      const name =
        property?.type === 'Property' && property.kind === 'init' && !property.method
          ? staticKey(property)
          : undefined;
      if (name === undefined || property?.type !== 'Property') {
        // It may set any arg written before it.
        nodes = {};
      } else {
        nodes[name] = property.value;
      }
    }
  }
  return nodes;
}
