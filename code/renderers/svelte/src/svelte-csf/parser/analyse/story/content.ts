import { dedent } from 'ts-dedent';

import {
  getDefineMetaComponentName,
  getDefineMetaComponentValue,
} from '../define-meta/component-identifier.ts';
import type { SvelteAST } from '../../ast.ts';
import type { extractSvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { extractStoryTemplateSnippetBlock } from '../../extract/svelte/story/template.ts';
import {
  findMetaRenderSnippetBlock,
  findStoryAttributeTemplateSnippetBlock,
} from '../../extract/svelte/snippet-block.ts';
import { extractStoryAttributesNodes } from '../../extract/svelte/story/attributes.ts';

interface Params {
  nodes: {
    component: SvelteAST.Component;
    svelte: Awaited<ReturnType<typeof extractSvelteASTNodes>>;
  };
  // Overrides the `asChild` prop of the component, for a story that inherits it
  asChild?: boolean;
  originalCode: string;
  filename?: string;
}

export function getStoryContentRawCode(params: Params): string {
  const { nodes, originalCode, filename } = params;
  const { component, svelte } = nodes;

  // `<Story />` component is self-closing...
  if (component.fragment.nodes.length === 0) {
    // <Story template={snippet} />
    const storyAttributTemplateSnippetBlock = findStoryAttributeTemplateSnippetBlock({
      component,
      nodes: svelte,
      filename,
    });

    if (storyAttributTemplateSnippetBlock) {
      return getSnippetBlockBodyRawCode(originalCode, storyAttributTemplateSnippetBlock);
    }

    // defineMeta({ render: snippet })
    const metaRenderSnippetBlock = findMetaRenderSnippetBlock({
      nodes: svelte,
      filename,
    });

    if (metaRenderSnippetBlock) {
      return getSnippetBlockBodyRawCode(originalCode, metaRenderSnippetBlock);
    }

    // <Story /> with no template and no meta render
    const defineMetaComponentValue = getDefineMetaComponentValue({
      nodes: svelte,
      filename,
    });

    // NOTE: It should never be `undefined` in this particular case, otherwise Storybook wouldn't know what to render.
    return `<${getDefineMetaComponentName(defineMetaComponentValue)} {...args} />`;
  }

  // <Story>{#snippet template(args)}...{/snippet}</Story>
  const storyChildrenSnippetBlock = extractStoryTemplateSnippetBlock(component);

  if (storyChildrenSnippetBlock) {
    return getSnippetBlockBodyRawCode(originalCode, storyChildrenSnippetBlock);
  }

  // <Story asChild>...</Story>
  const asChild =
    params.asChild ?? extractStoryAttributesNodes({ component, attributes: ['asChild'] }).asChild;

  const { fragment } = component;
  const firstNode = fragment.nodes[0];
  const lastNode = fragment.nodes[fragment.nodes.length - 1];
  const rawCode = dedent(originalCode.slice(firstNode.start, lastNode.end)).trim();

  if (asChild) {
    return rawCode;
  }

  // <Story>...</Story>, where the content becomes the children of the meta component
  const defineMetaComponentValue = getDefineMetaComponentValue({
    nodes: svelte,
    filename,
  });

  // If there's no component defined in defineMeta, return the raw code directly
  // This handles static templates without a component wrapper
  if (!defineMetaComponentValue) {
    return rawCode;
  }

  const componentName = getDefineMetaComponentName(defineMetaComponentValue);

  return dedent(`<${componentName} {...args}>
    ${rawCode}
  </${componentName}>`).trim();
}

function getSnippetBlockBodyRawCode(originalCode: string, node: SvelteAST.SnippetBlock) {
  const { body } = node;
  const { nodes } = body;
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const rawCode = originalCode.slice(firstNode.start, lastNode.end);

  return dedent(rawCode).trim();
}
