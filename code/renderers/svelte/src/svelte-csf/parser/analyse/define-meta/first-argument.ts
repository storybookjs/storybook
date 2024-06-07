import type { ObjectExpression } from 'estree';

import type { CompiledASTNodes } from '../../extract/compiled/nodes.js';

interface Params {
  nodes: CompiledASTNodes;
  filename?: string;
}

/**
 * Extract AST node of {@link ObjectExpression} from the first argument passed down to `defineMeta()`.
 */
export function getDefineMetaFirstArgumentNode(params: Params): ObjectExpression {
  const { nodes, filename } = params;
  const { defineMetaVariableDeclaration, defineMetaImport } = nodes;
  const { declarations } = defineMetaVariableDeclaration;

  const declaration = declarations[0];
  const { init } = declaration;

  if (
    init?.type !== 'CallExpression' ||
    init.callee.type !== 'Identifier' ||
    init.callee.name !== defineMetaImport.local.name || // NOTE: the callee.name could be renamed by user
    init.arguments.length !== 1 ||
    init.arguments[0].type !== 'ObjectExpression'
  ) {
    // TODO: Implement detailed error messages
    throw new Error();
  }

  return init.arguments[0];
}
