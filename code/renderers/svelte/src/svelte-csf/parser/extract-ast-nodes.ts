import type { Script } from 'svelte/compiler';

import type { AddonASTNodes } from './types.js';
import { walkOnModule } from './walkers/module.js';

/**
 * Pick only required AST nodes for further usage in this addon.
 */
export function extractASTNodes(module: Script | null): AddonASTNodes {
  if (!module) {
    throw new Error(`The stories file must have a module tag ('<script context="module">').`);
  }

  return walkOnModule(module);
}
