import type { ESTreeAST } from '../../ast.ts';
import { extractDefineMetaPropertiesNodes } from '../../extract/svelte/define-meta.ts';
import type { SvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { InvalidRenderValueError } from '../../../utils/error/parser/analyse/define-meta.ts';

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
