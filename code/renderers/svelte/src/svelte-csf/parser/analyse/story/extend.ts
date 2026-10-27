import type { SvelteAST } from '../../ast.ts';
import type { SvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { type StoryParents, getStoryChain } from '../../../utils/story-chain.ts';
import { extractStoryAttributesNodes } from '../../extract/svelte/story/attributes.ts';
import { getStringValueFromAttribute } from './attributes.ts';
import { getStoriesIdentifiers } from './attributes/identifiers.ts';
import {
  AttributeNotStringError,
  StoryExtendCycleError,
  StoryExtendDuplicateNameError,
  StoryExtendNotFoundError,
  StoryExtendUnnamedError,
  StoryExtendWithoutFactoryError,
} from '../../../utils/error/parser/analyse/story.ts';

export interface ExtendableStory {
  component: SvelteAST.Component;
  exportName: string;
  // The `name` prop. A story without it can't be extended.
  name: string | undefined;
}

export function getExtendableStories(
  nodes: SvelteASTNodes,
  filename?: string
): Array<ExtendableStory & SvelteASTNodes['storyComponents'][number]> {
  return getStoriesIdentifiers({ nodes, filename }).map((identifiers, index) => ({
    ...identifiers,
    ...nodes.storyComponents[index],
  }));
}

interface Params {
  stories: ExtendableStory[];
  isFactory: boolean;
  filename?: string;
}

// Find the story that each `<Story extend="...">` extends.
export function getStoryParents(params: Params): StoryParents {
  const { stories, isFactory, filename } = params;
  const parents: StoryParents = new Map();

  for (const { component, exportName } of stories) {
    const { extend: extendNode } = extractStoryAttributesNodes({
      component,
      attributes: ['extend'],
    });
    const extend = getStringValueFromAttribute({ node: extendNode, filename, component });
    if (extend === undefined || !extendNode) {
      continue;
    }
    // The runtime reads the whole value, so a value of more than one part isn't static
    if (Array.isArray(extendNode.value) && extendNode.value.length > 1) {
      throw new AttributeNotStringError({ filename, component, attribute: extendNode });
    }
    if (!isFactory) {
      throw new StoryExtendWithoutFactoryError({ filename, component });
    }

    // The runtime extends no story when the value is empty
    const namedStories = stories.filter((story) => extend !== '' && story.name === extend);
    if (namedStories.length > 1) {
      throw new StoryExtendDuplicateNameError({ filename, component, extend });
    }
    if (namedStories.length === 0) {
      const byExportName = stories.find((story) => story.exportName === extend);
      if (byExportName && byExportName.name === undefined) {
        throw new StoryExtendUnnamedError({ filename, component, extend });
      }
      throw new StoryExtendNotFoundError({
        filename,
        component,
        extend,
        suggestedName: byExportName?.name,
      });
    }
    parents.set(exportName, namedStories[0].exportName);
  }

  for (const { component, exportName } of stories) {
    const chain = getStoryChain(parents, exportName);
    if (parents.has(chain.at(-1)!)) {
      const names = [...chain, parents.get(chain.at(-1)!)!].map(
        (name) => stories.find((story) => story.exportName === name)!.name ?? name
      );
      throw new StoryExtendCycleError({ filename, component, names });
    }
  }

  return parents;
}

// Order the export names so that each parent story comes before the stories that extend it.
export function orderByParents(exportNames: string[], parents: StoryParents): string[] {
  const ordered = new Set<string>();
  for (const exportName of exportNames) {
    for (const name of getStoryChain(parents, exportName).reverse()) {
      ordered.add(name);
    }
  }
  return [...ordered];
}

export interface StoryContent {
  // The `<Story>` whose children or `template` the story renders
  component: SvelteAST.Component;
  // Whether the story renders the children without the component
  asChild: boolean;
}

// A story renders its own content, or else the content of the nearest story it extends that has
// content. It inherits `asChild` on its own in the same way.
export function getStoryContent(
  stories: ExtendableStory[],
  parents: StoryParents,
  exportName: string
): StoryContent {
  const chain = getStoryChain(parents, exportName).map(
    (name) => stories.find((story) => story.exportName === name)!.component
  );
  const asChild = chain
    .map((component) => extractStoryAttributesNodes({ component, attributes: ['asChild'] }).asChild)
    .find((node) => node !== undefined);
  return {
    component: chain.find(hasStoryContent) ?? chain[0],
    asChild: asChild !== undefined && isTrue(asChild),
  };
}

function hasStoryContent(component: SvelteAST.Component): boolean {
  const { children, template } = extractStoryAttributesNodes({
    component,
    attributes: ['children', 'template'],
  });
  return component.fragment.nodes.some(rendersAsContent) || !!children || !!template;
}

// Svelte drops comments and whitespace from the children of a component, and turns a snippet into a
// prop. So `<Story>` gets `children` or `template` only from the other nodes and those snippets.
function rendersAsContent(node: SvelteAST.Fragment['nodes'][number]): boolean {
  switch (node.type) {
    case 'Comment':
      return false;
    case 'Text':
      return !/^[ \t\r\n]*$/.test(node.data);
    case 'SnippetBlock':
      return node.expression.name === 'template' || node.expression.name === 'children';
    default:
      return true;
  }
}

// `asChild` and `asChild={true}` are true. An expression that isn't a literal could be true.
function isTrue({ value }: SvelteAST.Attribute): boolean {
  const expression = value !== true && !Array.isArray(value) ? value.expression : undefined;
  return expression?.type !== 'Literal' || Boolean(expression.value);
}
