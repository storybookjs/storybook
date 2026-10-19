import type { SvelteAST } from '../../../ast.ts';
import { isOneOf } from '../../../../utils/is-one-of.ts';
import type { Cmp, StoryProps } from '../../../../types.ts';

type StoryAttributes = Array<keyof StoryProps<Record<string, any>, Cmp>>;

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
      isOneOf<Attributes[number]>(attributes, attributeNode.name)
    ) {
      results[attributeNode.name] = attributeNode;
    }
  }

  return results;
}
