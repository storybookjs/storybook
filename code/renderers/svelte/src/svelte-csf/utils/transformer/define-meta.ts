// TODO: Refactor - move it to post-transform. And from the ESTree AST, not source Svelte AST.

import type { AssignmentProperty } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';
import type { BaseNode } from 'svelte/compiler';

import type { SvelteASTNodes } from '../parser/extract-ast-nodes.js';

interface Params {
  code: MagicString;
  nodes: SvelteASTNodes;
  filename: string;
}

export function transformDefineMeta(params: Params) {
  const { code, nodes, filename } = params;
  const { defineMetaVariableDeclaration } = nodes;
  const { declarations } = defineMetaVariableDeclaration;
  const { id } = declarations[0];

  if (id.type !== 'ObjectPattern') {
    // TODO: make error message more user friendly
    // what happened, how to fix
    throw new Error(
      `Internal error during attempt to pre-transform the Stories source code - expected object pattern. Stories file: ${filename}`
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

  const { start, end } = defineMetaVariableDeclaration as unknown as BaseNode;

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
