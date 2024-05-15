import dedent from 'dedent';
import type { Attribute, Component, SnippetBlock } from 'svelte/compiler';

export function getStringFromAttribute(name: string, attributes: Component['attributes']) {
  const attribute = lookupAttribute(name, attributes);

  if (!attribute) {
    return;
  }

  const { value } = attribute;

  if (value === true) {
    throw new Error(`Attribute 'name' is not a string`);
  }

  if (value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(`Attribute "name" is not static`);
}

export function lookupAttribute(name: string, attributes: Component['attributes']) {
  return attributes.find((node) => {
    if (node.type === 'Attribute' && node.name === name) {
      return node.value;
    }
  }) as Attribute | undefined;
}

export function getComponentChildrenRawSource({
  node,
  rawSource,
}: {
  node: Component;
  rawSource: string;
}) {
  const { fragment } = node;
  const { nodes } = fragment;

  // Ignore addon components without children
  if (nodes.length === 0) {
    return;
  }

  const snippetBlockChildren = nodes.find(
    (c) => c.type === 'SnippetBlock' && c.expression.name === 'children'
  ) as SnippetBlock | undefined;

  if (snippetBlockChildren) {
    const { body } = snippetBlockChildren;
    const { nodes } = body;
    const { start } = nodes[0];
    const { end } = nodes[nodes.length - 1];

    return dedent`${rawSource.slice(start, end)}`;
  }

  const { start } = nodes[0];
  const { end } = nodes[nodes.length - 1];

  return dedent`${rawSource.slice(start, end)}`;
}
