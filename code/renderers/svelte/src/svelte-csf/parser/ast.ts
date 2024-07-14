import { compile, type Root } from 'svelte/compiler';

interface GetSvelteASTOptions {
  code: string;
  filename?: string;
}

export function getSvelteAST(options: GetSvelteASTOptions) {
  const { filename, code } = options;
  const { ast }: { ast: Root } = compile(code, {
    filename,
    modernAst: true,
  });

  return ast;
}
