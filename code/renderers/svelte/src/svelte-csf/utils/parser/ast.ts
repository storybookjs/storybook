import { compile, type Root } from 'svelte/compiler';

export function getAST(source: string) {
  const { ast }: { ast: Root } = compile(source, { modernAst: true });

  return ast;
}
