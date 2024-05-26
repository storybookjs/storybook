import type { AssignmentProperty, Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';
import type { BaseNode } from 'svelte/compiler';

import { type AddonASTNodes } from '../parser/types.js';

export function transformDefineMeta({ code, nodes }: { code: MagicString; nodes: AddonASTNodes }) {
  const { defineMetaVar } = nodes;
  const { declarations } = defineMetaVar;
  const { id } = declarations[0];

  if (id.type !== 'ObjectPattern') {
    // TODO: make error message more user friendly
    // which file, what happened, how to fix
    throw new Error(
      'Internal error during attempt to pre-transform the Stories source code - expected object pattern.'
    );
  }

  const hasDestructuredMeta = id.properties.find((p) => {
    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta';
  });

  if (hasDestructuredMeta) {
    return code;
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

  const { start, end } = defineMetaVar as unknown as BaseNode;

  code.update(start, end, toJs(defineMetaVar as unknown as Program).value);
}
