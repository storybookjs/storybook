import type MagicString from 'magic-string';
import type { AssignmentProperty, Program } from 'estree';
import { toJs } from 'estree-util-to-js';

import { type StoriesFileMeta } from '../parser/types.js';
import type { BaseNode } from 'svelte/compiler';

export function transformDefineMeta({
  code,
  storiesFileMeta,
}: {
  code: MagicString;
  storiesFileMeta: StoriesFileMeta;
}) {
  const { module } = storiesFileMeta;
  const { defineMetaVariableDeclarator } = module;
  const { id } = defineMetaVariableDeclarator;

  if (id.type !== 'ObjectPattern') {
    throw new Error(
      'Internal error during attempt to pre-transform the Stories source code - expected object pattern.'
    );
  }

  const hasDestructuredMeta = id.properties.find((p) => {
    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'meta';
  });

  if (!hasDestructuredMeta) {
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

    const { start, end } = defineMetaVariableDeclarator as unknown as BaseNode;

    code.update(start, end, toJs(defineMetaVariableDeclarator as unknown as Program).value);
  }

  return code;
}
