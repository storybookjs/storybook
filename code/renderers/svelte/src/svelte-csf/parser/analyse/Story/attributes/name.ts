import type { Attribute } from 'svelte/compiler';

import { getStringValueFromAttribute } from '../attributes.js';
import type { SvelteASTNodes } from '../../../extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../../extract/svelte/Story/attributes.js';

interface GetNameParams {
  node?: Attribute | undefined;
  filename?: string;
}

export function getNameFromStoryAttribute(options: GetNameParams) {
  const { node, filename } = options;

  const name = getStringValueFromAttribute({ node, filename });

  if (!name) {
    throw new Error(
      `Missing attribute 'name' in one of <Story /> component. Stories file: ${filename}`
    );
  }

  return name;
}

interface Params {
  nodes: SvelteASTNodes;
  filename?: string;
}

export async function getStoriesNames(params: Params): Promise<string[]> {
  const { nodes, filename } = params;
  const { storyComponents } = nodes;
  const names: string[] = [];

  for (const story of storyComponents) {
    const { name } = extractStoryAttributesNodes({
      component: story.component,
      filename,
      attributes: ['name'],
    });

    names.push(getNameFromStoryAttribute({ node: name, filename }));
  }

  return names;
}
