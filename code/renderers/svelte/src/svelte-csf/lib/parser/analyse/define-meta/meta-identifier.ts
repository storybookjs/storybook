import type { ESTreeAST } from '$lib/parser/ast.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import {
  NoDestructuredDefineMetaCallError,
  NoMetaIdentifierFoundError,
} from '$lib/utils/error/parser/analyse/define-meta.js';

interface Params {
  node: SvelteASTNodes['defineMetaVariableDeclaration'];
  filename?: string;
}

export function getMetaIdentifier(params: Params): ESTreeAST.Identifier {
  const { node, filename } = params;
  const { declarations } = node;
  const { id } = declarations[0];

  if (id.type !== 'ObjectPattern') {
    throw new NoDestructuredDefineMetaCallError({
      filename,
      defineMetaVariableDeclarator: declarations[0],
    });
  }

  const { properties } = id;

  const metaProperty = properties.find(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta'
  );

  if (
    !metaProperty ||
    metaProperty.type !== 'Property' ||
    metaProperty.value.type !== 'Identifier'
  ) {
    throw new NoMetaIdentifierFoundError(filename);
  }

  return metaProperty.value;
}
