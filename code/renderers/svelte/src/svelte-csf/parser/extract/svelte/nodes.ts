import type { Root } from 'svelte/compiler';

import { extractModuleNodes } from './module-nodes.js';
import { extractFragmentNodes } from './fragment-nodes.js';

/**
 * Selected nodes extracted from the Svelte AST via `svelte.compile`,
 * needed for further code analysis/transformation.
 */
export type SvelteASTNodes = Awaited<ReturnType<typeof extractModuleNodes>> &
  Awaited<ReturnType<typeof extractFragmentNodes>>;

interface ExtractSvelteASTNodesOptions {
  ast: Root;
  filename?: string;
}

/**
 * Pick only required Svelte AST nodes for further usage in this addon.
 */
export async function extractSvelteASTNodes(
  options: ExtractSvelteASTNodesOptions
): Promise<SvelteASTNodes> {
  const { ast, filename } = options;
  const { module, fragment } = ast;

  // TODO: Perhaps we can use some better way to insert error messages?
  // String interpolations doesn't feel right if we want to provide a whole example (code snippet).
  if (!module) {
    throw new Error(
      `Couldn't find a module tag. Add (<script context="module">) to the stories file: ${filename}`
    );
  }

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
