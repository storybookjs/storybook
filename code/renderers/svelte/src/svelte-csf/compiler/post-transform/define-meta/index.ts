import { print } from 'esrap';
import type MagicString from 'magic-string';

import { replaceDefineMetaArgument } from './replace-argument';
import { insertDefineMetaJSDocCommentAsDescription } from './insert-description.js';

import { createASTIdentifier, type ESTreeAST } from '$lib/parser/ast.js';
import type { CompiledASTNodes } from '$lib/parser/extract/compiled/nodes.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';

interface Params {
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename?: string;
}

/**
 * Attempt to transform compiled `defineMeta()` when necessary.
 * And in the end, update the compiled code using {@link MagicString}.
 */
export function transformDefineMeta(params: Params): void {
  const { code, nodes, filename } = params;

  insertDefineMetaJSDocCommentAsDescription({
    nodes,
    filename,
  });
  const metaObjectExpression = replaceDefineMetaArgument({
    nodes,
    filename,
  });
  const metaVariableDeclaration = createMetaVariableDeclaration({
    init: metaObjectExpression,
  });

  const { compiled } = nodes;
  const { defineMetaVariableDeclaration } = compiled;
  const { start, end } = defineMetaVariableDeclaration;

  code.update(start as number, end as number, print(defineMetaVariableDeclaration).code);
  code.appendLeft(start as number, print(metaVariableDeclaration).code + '\n');
}

export function createMetaVariableDeclaration({
  init,
}: {
  init: ESTreeAST.ObjectExpression;
}): ESTreeAST.VariableDeclaration {
  //
  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: createASTIdentifier('meta'),
        init,
      },
    ],
  };
}
