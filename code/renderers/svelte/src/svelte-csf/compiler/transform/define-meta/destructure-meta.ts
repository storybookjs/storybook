import type { AssignmentProperty } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';

import type { CompiledASTNodes } from '../../../parser/extract/compiled/nodes.js';

interface Params {
  code: MagicString;
  nodes: CompiledASTNodes;
  filename: string;
}

export async function destructureMetaFromDefineMeta(params: Params) {
  const { code, nodes, filename } = params;
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

  const hasDestructuredMeta = id.properties.find((p) => {
    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta';
  });

  if (hasDestructuredMeta) {
    return;
  }

  const metaProperty: AssignmentProperty = {
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
  };

  id.properties.push(metaProperty);

  // @ts-expect-error FIXME: No idea which type includes start/end, they exist at runtime
  const { start, end } = defineMetaVariableDeclaration;

  code.update(
    start,
    end,
    toJs({
      type: 'Program',
      sourceType: 'module',
      body: [defineMetaVariableDeclaration],
    }).value
  );
}
