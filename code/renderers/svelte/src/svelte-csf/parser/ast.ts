import type * as ESTreeAST from 'estree';
import { compile, type AST as SvelteAST } from 'svelte/compiler';

interface GetSvelteASTOptions {
  code: string;
  filename?: string;
}

export function getSvelteAST(options: GetSvelteASTOptions) {
  const { filename, code } = options;
  const { ast }: { ast: SvelteAST.Root } = compile(code, {
    filename,
    modernAst: true,
  });

  return ast;
}

export type { SvelteAST, ESTreeAST };
