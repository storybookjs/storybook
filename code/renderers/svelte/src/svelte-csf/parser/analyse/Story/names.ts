import { getNameFromStoryAttribute } from './attributes.js';

import type { SvelteASTNodes } from '../../extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../extract/svelte/Story/attributes.js';

interface Params {
  nodes: SvelteASTNodes;
  filename: string;
}

export async function getStoriesNames(params: Params): Promise<string[]> {
  const { nodes, filename } = params;
  const { storyComponents } = nodes;
  const names: string[] = [];

  for (const story of storyComponents) {
    const { name } = await extractStoryAttributesNodes({
      component: story.component,
      filename,
      attributes: ['name'],
    });

    names.push(getNameFromStoryAttribute({ node: name, filename }));
  }

  return names;
}
