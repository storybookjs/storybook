import type { Attribute } from 'svelte/compiler';

import { getArrayOfStringsValue } from '../attributes.js';

interface Params {
  node: Attribute | undefined;
  filename?: string;
}

export function getTagsFromStoryAttribute(params: Params) {
  const { node, filename } = params;

  if (node) {
    return getArrayOfStringsValue({ node, filename });
  }

  return [];
}
