import type { ESTreeAST } from '../../ast.ts';
import { extractDefineMetaPropertiesNodes } from '../../extract/svelte/define-meta.ts';
import type { SvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { InvalidComponentValueError } from '../../../utils/error/parser/analyse/define-meta.ts';

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
