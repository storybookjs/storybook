import type { SvelteAST } from '../../../ast.ts';

type Result = SvelteAST.SnippetBlock | undefined;

export function extractStoryTemplateSnippetBlock(component: SvelteAST.Component): Result {
  const { fragment } = component;
  const { nodes } = fragment;

  return nodes.find(
    (node) => node.type === 'SnippetBlock' && node.expression.name === 'template'
  ) as Result;
}
