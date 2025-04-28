import { extractModuleNodes } from './module-nodes.js';
import { extractFragmentNodes } from './fragment-nodes.js';

import type { SvelteAST } from '$lib/parser/ast.js';

/**
 * Selected nodes extracted from the Svelte AST via `svelte.compile`,
 * needed for further code analysis/transformation.
 */
export type SvelteASTNodes = Awaited<ReturnType<typeof extractModuleNodes>> &
  Awaited<ReturnType<typeof extractFragmentNodes>>;

interface Params {
  ast: SvelteAST.Root;
  filename?: string;
}

/**
 * Pick only required Svelte AST nodes for further usage in this addon.
 */
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
