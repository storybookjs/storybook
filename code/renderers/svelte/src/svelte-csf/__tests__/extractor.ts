import { getSvelteAST } from '#parser/ast';
import dedent from 'dedent';
import type { Script, SvelteNode } from 'svelte/compiler';
import { type Context } from 'zimmerframe';

export async function extractSvelteNode<TNode extends SvelteNode | Script>(
  parsed: SvelteNode | Script,
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

export async function parseAndExtractSvelteNode<TNode extends SvelteNode | Script>(
  code: string,
  name: TNode['type']
): Promise<TNode> {
  const parsed = getSvelteAST({ code: dedent(code) });
  return await extractSvelteNode(parsed as SvelteNode | Script, name);
}
