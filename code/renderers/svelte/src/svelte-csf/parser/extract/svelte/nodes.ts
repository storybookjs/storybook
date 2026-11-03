import { extractModuleNodes } from './module-nodes.ts';
import { extractFragmentNodes } from './fragment-nodes.ts';

import type { SvelteAST } from '../../ast.ts';

export type SvelteASTNodes = Awaited<ReturnType<typeof extractModuleNodes>> &
  Awaited<ReturnType<typeof extractFragmentNodes>>;

interface Params {
  ast: SvelteAST.Root;
  filename?: string;
}

export async function extractSvelteASTNodes(params: Params): Promise<SvelteASTNodes> {
  const { ast, filename } = params;
  const { module, fragment } = ast;

  const moduleNodes = await extractModuleNodes({ module, filename });
  const fragmentNodes = await extractFragmentNodes({
    fragment,
    filename,
    moduleNodes,
  });

  return {
    ...moduleNodes,
    ...fragmentNodes,
  };
}
