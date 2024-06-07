import type { Identifier } from 'estree';

import { extractDefineMetaPropertiesNodes } from '../../extract/define-meta-properties.js';
import type { SvelteASTNodes } from '../../extract/svelte/nodes.js';

interface Params {
  nodes: SvelteASTNodes;
  filename?: string;
}

export function getDefineMetaComponentValue(params: Params): Identifier | undefined {
  const { nodes, filename } = params;
  const { component } = extractDefineMetaPropertiesNodes({
    nodes,
    properties: ['component'],
  });

  if (!component) {
    return;
  }

  const { value } = component;

  if (value.type !== 'Identifier') {
    throw new Error(
      `Invalid schema. 'defineMeta's property 'component' value should be an identifier to Svelte's component import specifier. Stories file: ${filename}`
    );
  }

  return value;
}
