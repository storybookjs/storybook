import dedent from 'dedent';
import { type Context } from 'zimmerframe';

import { getSvelteAST, type SvelteAST } from '$lib/parser/ast';

export async function extractSvelteNode<TNode extends SvelteAST.SvelteNode | SvelteAST.Script>(
  parsed: SvelteAST.SvelteNode | SvelteAST.Script,
  name: TNode['type']
): Promise<TNode> {
  const { walk } = await import('zimmerframe');

  let target: TNode | undefined = undefined;

  walk(parsed, null, {
    [name](node: TNode, context: Context<Node, null>) {
      const { stop } = context;
      target = node;
      stop();
    },
  });

  if (!target) {
    throw new Error(`Could not find the in the parsed Svelte AST a target node: ${name}`);
  }

  return target;
}

export async function parseAndExtractSvelteNode<
  TNode extends SvelteAST.SvelteNode | SvelteAST.Script,
>(code: string, name: TNode['type']): Promise<TNode> {
  const parsed = getSvelteAST({ code: dedent(code) });
  return await extractSvelteNode(parsed as SvelteAST.SvelteNode | SvelteAST.Script, name);
}
