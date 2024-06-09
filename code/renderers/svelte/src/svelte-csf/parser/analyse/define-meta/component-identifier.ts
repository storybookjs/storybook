import type { Identifier } from 'estree';

import { extractDefineMetaPropertiesNodes } from '#parser/extract/svelte/define-meta-properties';
import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';

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
