import type { ESTreeAST } from '$lib/parser/ast.js';
import { extractDefineMetaPropertiesNodes } from '$lib/parser/extract/svelte/define-meta.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import { InvalidComponentValueError } from '$lib/utils/error/parser/analyse/define-meta.js';

interface Params {
  nodes: SvelteASTNodes;
  filename?: string;
}

export function getDefineMetaComponentValue(params: Params): ESTreeAST.Identifier | undefined {
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
