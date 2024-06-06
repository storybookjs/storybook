import type { Identifier } from 'estree';

import { extractMetaPropertiesNodes } from '../../extract/meta-properties.js';
import type { SvelteASTNodes } from '../../extract/svelte/nodes.js';

interface Params {
  svelteASTNodes: SvelteASTNodes;
  filename?: string;
}

export function getDefineMetaComponentValue(params: Params): Identifier | undefined {
  const { svelteASTNodes, filename } = params;
  const { component } = extractMetaPropertiesNodes({
    nodes: svelteASTNodes,
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
