import type { Attribute, Component } from 'svelte/compiler';

import type { StoryCmpProps } from '#types';

type StoryAttributes = Array<keyof StoryCmpProps>;

interface Options<Attributes extends StoryAttributes> {
  component: Component;
  filename?: string;
  attributes: Attributes;
}

type Result<Attributes extends StoryAttributes> = Partial<{
  [Key in Attributes[number]]: Attribute;
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
