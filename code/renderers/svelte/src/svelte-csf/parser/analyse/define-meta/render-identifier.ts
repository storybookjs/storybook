import type { ESTreeAST } from '$lib/parser/ast.js';
import { extractDefineMetaPropertiesNodes } from '$lib/parser/extract/svelte/define-meta.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import { InvalidRenderValueError } from '$lib/utils/error/parser/analyse/define-meta.js';

interface Params {
  nodes: SvelteASTNodes;
  filename?: string;
}

export function getDefineMetaRenderValue(params: Params): ESTreeAST.Identifier | undefined {
  const { nodes, filename } = params;
  const { render } = extractDefineMetaPropertiesNodes({
    nodes,
    properties: ['render'],
  });

  if (!render) {
    return;
  }

  const { value } = render;

  if (value.type !== 'Identifier') {
    throw new InvalidRenderValueError({
      filename,
      renderProperty: render,
    });
  }

  return value;
}
