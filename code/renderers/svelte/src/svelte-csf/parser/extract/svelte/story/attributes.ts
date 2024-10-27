import type { ComponentProps } from 'svelte';

import type { SvelteAST } from '#parser/ast';
import type { Cmp } from '#types';
import type Story from '#runtime/Story.svelte';

type StoryAttributes = Array<keyof ComponentProps<typeof Story<Cmp>>>;

interface Options<Attributes extends StoryAttributes> {
  component: SvelteAST.Component;
  filename?: string;
  attributes: Attributes;
}

type Result<Attributes extends StoryAttributes> = Partial<{
  [Key in Attributes[number]]: SvelteAST.Attribute;
}>;

export function extractStoryAttributesNodes<const Attributes extends StoryAttributes>(
  options: Options<Attributes>
): Result<Attributes> {
  const { attributes, component } = options;

  const results: Result<Attributes> = {};

  for (const attributeNode of component.attributes) {
    if (
      attributeNode.type === 'Attribute' &&
      attributes.includes(attributeNode.name as Attributes[number])
    ) {
      results[attributeNode.name] = attributeNode;
    }
  }

  return results;
}
