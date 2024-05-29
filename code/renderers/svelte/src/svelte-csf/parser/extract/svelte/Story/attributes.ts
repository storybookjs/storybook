import type { StoryObj } from '@storybook/svelte';
import type { Attribute, Component } from 'svelte/compiler';

interface Options<Attributes extends Array<keyof StoryObj>> {
  component: Component;
  filename?: string;
  attributes: Attributes;
}

type Result<Attributes extends Array<keyof StoryObj>> = Partial<{
  [Key in Attributes[number]]: Attribute;
}>;

export function extractStoryAttributesNodes<const Attributes extends Array<keyof StoryObj>>(
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
