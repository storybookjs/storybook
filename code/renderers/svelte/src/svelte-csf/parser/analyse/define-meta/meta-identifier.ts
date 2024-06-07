import type { Identifier } from 'estree';

import type { SvelteASTNodes } from '../../extract/svelte/nodes.js';

interface Params {
  node: SvelteASTNodes['defineMetaVariableDeclaration'];
  filename?: string;
}

export function getMetaIdentifier(params: Params): Identifier {
  const { node, filename } = params;
  const { declarations } = node;
  const { id } = declarations[0];

  if (id.type !== 'ObjectPattern') {
    throw new Error(
      `Invalid schema. Expected 'ObjectPattern' while trying to access 'meta' identifier from the variable declaration with destructured return of 'defineMeta()' call. Stories filename: ${filename}`
    );
  }

  const { properties } = id;

  const property = properties.find(
    (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta'
  );

  if (!property || property.type !== 'Property' || property.value.type !== 'Identifier') {
    throw new Error(
      `Could not find 'meta' identifier in the output code for stories file: ${filename}`
    );
  }

  return property.value;
}
