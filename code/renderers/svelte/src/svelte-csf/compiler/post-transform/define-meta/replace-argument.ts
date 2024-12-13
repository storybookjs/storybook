import { createASTIdentifier, type ESTreeAST } from '../../../parser/ast';
import type { CompiledASTNodes } from '../../../parser/extract/compiled/nodes';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes';
import { getDefineMetaFirstArgumentObjectExpression } from '../../../parser/extract/svelte/define-meta';
import { NoDestructuredDefineMetaCallError } from '../../../utils/error/parser/analyse/define-meta';

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

  if (
    !declaration ||
    declaration.init?.type !== 'CallExpression' ||
    declaration?.init?.callee.type !== 'Identifier' ||
    declaration?.init?.callee.name !== 'defineMeta'
  ) {
    throw new NoDestructuredDefineMetaCallError({
      defineMetaVariableDeclarator: declaration,
      filename: params.filename,
    });
  }

  declaration.init.arguments[0] = createASTIdentifier('meta');
  params.nodes.compiled.defineMetaVariableDeclaration.declarations[0] = declaration;

  return defineMetaFirstArgumentObjectExpression;
}
