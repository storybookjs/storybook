import type { Root } from 'svelte/compiler';

import type { StoriesFileMeta } from './types.js';
import { walkOnFragment } from './walkers/fragment.js';
import { walkOnDefineMeta } from './walkers/define-meta.js';
import type { SvelteASTNodes } from './extract-ast-nodes.js';

interface Params {
  ast: Root;
  nodes: SvelteASTNodes;
  source: string;
  filename: string;
}

/**
 * Parse raw stories file component in Svelte format,
 * and extract the most stories file meta,
 * which are required to generate `StoryFn's` for `@storybook/svelte` components.
 */
export async function extractStories(params: Params): Promise<StoriesFileMeta> {
  const { ast, nodes, source } = params;
  const { fragment } = ast;
  const [defineMeta, { stories }] = await Promise.all([
    walkOnDefineMeta(nodes),
    walkOnFragment({
      fragment,
      source: source,
      nodes,
    }),
  ]);

  return {
    defineMeta,
    stories,
  };
}
