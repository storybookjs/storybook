import { extractModuleNodes } from './module-nodes';
import { extractFragmentNodes } from './fragment-nodes';
import { extractInstanceNodes } from './instance-nodes';

import type { SvelteAST } from '$lib/parser/ast';

/**
 * Selected nodes extracted from the Svelte AST via `svelte.compile`,
 * needed for further code analysis/transformation.
 */
export type SvelteASTNodes = Awaited<ReturnType<typeof extractModuleNodes>> &
  Awaited<ReturnType<typeof extractFragmentNodes>> &
  Awaited<ReturnType<typeof extractInstanceNodes>>;

interface Params {
  ast: SvelteAST.Root;
  filename?: string;
}

/**
 * Pick only required Svelte AST nodes for further usage in this addon.
 */
export async function extractSvelteASTNodes(params: Params): Promise<SvelteASTNodes> {
  const { ast, filename } = params;
  const { module, fragment, instance } = ast;

  const moduleNodes = await extractModuleNodes({ module, filename });
  const instanceNodes = await extractInstanceNodes({
    instance,
    filename,
    moduleNodes,
  });
  const fragmentNodes = await extractFragmentNodes({
    fragment,
    filename,
    moduleNodes,
    instanceNodes,
  });

  return {
    ...moduleNodes,
    ...instanceNodes,
    ...fragmentNodes,
  };
}
