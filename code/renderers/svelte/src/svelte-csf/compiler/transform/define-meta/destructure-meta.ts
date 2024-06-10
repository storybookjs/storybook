import type { CompiledASTNodes } from '#parser/extract/compiled/nodes';

interface Params {
  nodes: CompiledASTNodes;
  filename?: string;
}

/**
 * Attempt to destructure 'meta' identifier in the object pattern of the variable declaration from call `defineMeta({...})`
 * if it wasn't done by user manually.
 *
 * Before:
 *
 * ```js
 * const { Story } = defineMeta({});
 * ```
 *
 * After:
 *
 * ```js
 * const { Story, meta } = defineMeta({});
 * ```
 */
export function destructureMetaFromDefineMeta(params: Params): void {
  const { nodes, filename } = params;
  const { defineMetaVariableDeclaration } = nodes;
  const { declarations } = defineMetaVariableDeclaration;
  const { id } = declarations[0];

  if (id.type !== 'ObjectPattern') {
    // TODO: make error message more user friendly
    // what happened, how to fix
    throw new Error(
      `Internal error during attempt to destructure 'meta' from 'defineMeta({ ... })' - expected object pattern. Stories file: ${filename}`
    );
  }

  const destructuredMeta = id.properties.find((p) => {
    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta';
  });

  if (destructuredMeta) {
    return;
  }

  id.properties.push({
    type: 'Property',
    kind: 'init',
    key: {
      type: 'Identifier',
      name: 'meta',
    },
    value: {
      type: 'Identifier',
      name: 'meta',
    },
    shorthand: true,
    computed: false,
    method: false,
  });
}
