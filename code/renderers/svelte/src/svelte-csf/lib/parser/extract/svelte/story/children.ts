import type { SvelteAST } from '$lib/parser/ast';

type Result = SvelteAST.SnippetBlock | undefined;

/**
 * Extract the {@link SnippetBlock}  of the individual `<Story />` if exists.
 *
 * This AST node will help us in the further transformation of the `parameters.docs.source.code` on the compiled code,
 * and at runtime.
 */
export function extractStoryChildrenSnippetBlock(component: SvelteAST.Component): Result {
  const { fragment } = component;
  const { nodes } = fragment;

  return nodes.find(
    (node) => node.type === 'SnippetBlock' && node.expression.name === 'children'
  ) as Result;
}
