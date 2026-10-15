import { createASTIdentifier, type ESTreeAST } from '../../../parser/ast.ts';
import type { CompiledASTNodes } from '../../../parser/extract/compiled/nodes.ts';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../../parser/extract/svelte/define-meta.ts';
import { NoDestructuredDefineMetaCallError } from '../../../utils/error/parser/analyse/define-meta.ts';

import { STORYBOOK_META_IDENTIFIER } from '../../../constants.ts';

interface Params {
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename?: string;
}

/**
 * Replaces `defineMeta({ ... })` with `defineMeta(meta)`,
 * and also it returns {@link ESTreeASTAST.ObjectExpression} which was replaced with {@link ESTreeAST.Identifier}
 */
export function replaceDefineMetaArgument(params: Params): ESTreeAST.ObjectExpression {
  const defineMetaFirstArgumentObjectExpression = getDefineMetaFirstArgumentObjectExpression({
    nodes: params.nodes.compiled,
    filename: params.filename,
  });

  const declaration = params.nodes.compiled.defineMetaVariableDeclaration.declarations[0];

  if (declaration?.init?.type !== 'CallExpression') {
    throw new NoDestructuredDefineMetaCallError({
      defineMetaVariableDeclarator: declaration,
      filename: params.filename,
    });
  }

  declaration.init.arguments[0] = createASTIdentifier(STORYBOOK_META_IDENTIFIER);
  params.nodes.compiled.defineMetaVariableDeclaration.declarations[0] = declaration;

  return defineMetaFirstArgumentObjectExpression;
}
