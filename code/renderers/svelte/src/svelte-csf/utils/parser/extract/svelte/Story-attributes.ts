import type { StoryObj } from '@storybook/svelte';
import type { Attribute, Component, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

interface Options<Attributes extends Array<keyof StoryObj>> {
  component: Component;
  filename: string;
  attributes: Attributes;
}

type Result<Attributes extends Array<keyof StoryObj>> = Partial<{
  [Key in Attributes[number]]: Attribute;
}>;

export async function extractStoryAttributesNodes<const Attributes extends Array<keyof StoryObj>>(
  options: Options<Attributes>
): Promise<Result<Attributes>> {
  const { walk } = await import('zimmerframe');

  const { attributes, component } = options;

  const state: Result<Attributes> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    Attribute(node, { state }) {
      if (attributes.includes(node.name as Attributes[number])) {
        state[node.name] = node;
      }
    },
  };

  walk(component, state, visitors);

  return state;
}
