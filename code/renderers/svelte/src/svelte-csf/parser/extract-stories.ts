import type { Fragment } from 'svelte/compiler';

import type { AddonASTNodes, StoriesFileMeta } from './types.js';
import { walkOnFragment } from './walkers/fragment.js';
import { walkOnDefineMeta } from './walkers/define-meta.js';

/**
 * Parse raw stories file component in Svelte format,
 * and extract the most stories file meta,
 * which are required to generate `StoryFn's` for `@storybook/svelte` components.
 */
export async function extractStories({
  nodes,
  fragment,
  source,
}: {
  nodes: AddonASTNodes;
  fragment: Fragment;
  source: string;
}): Promise<StoriesFileMeta> {
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
