import type { Identifier } from 'estree';

import { extractDefineMetaPropertiesNodes } from '#parser/extract/svelte/define-meta';
import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';
import { InvalidComponentValueError } from '#utils/error/parser/analyse/define-meta';

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
    throw new InvalidComponentValueError({
      filename,
      componentProperty: component,
    });
  }

  return value;
}
