import type { Component, SnippetBlock } from 'svelte/compiler';
import { format } from 'prettier';

import { getDefineMetaComponentValue } from '../meta/component-identifier.js';

import type { extractSvelteASTNodes } from '../../extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '../../extract/svelte/Story/attributes.js';
import { extractStoryChildrenSnippetBlock } from '../../extract/svelte/Story/children.js';

interface Params {
  component: Component;
  svelteASTNodes: Awaited<ReturnType<typeof extractSvelteASTNodes>>;
  originalCode: string;
  filename?: string;
}

/**
 * Determine the `source.code` of the `<Story />` component children.
 * Reference: Step 2 from the comment: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2143539873
 */
export async function getStoryChildrenRawSource(params: Params): Promise<string> {
  const { component, svelteASTNodes, originalCode, filename } = params;

  // `<Story />` component is self-closing...
  if (component.fragment.nodes.length === 0) {
    /**
     * Case - "explicit template" - `children` attribute references to a snippet block at the root level of fragment.
     *
     * Example:
     *
     * ```svelte
     * {#snippet template1(args)}
     *     <SomeComponent {...args} />
     * {/snippet}
     *
     * <Story name="Default" children={template1} />
     * ```
     */
    const storyAttributeChildrenSnippetBlock = findChildrenPropSnippetBlock(component, {
      svelteASTNodes,
      filename,
    });

    if (storyAttributeChildrenSnippetBlock) {
      return await getSnippetBlockBodyRawCode(originalCode, storyAttributeChildrenSnippetBlock);
    }

    /**
     * Case - `setTemplate was used in the instance tag of `*.stories.svelte` file
     *
     * Example:
     *
     * ```svelte
     * <script>
     *     setTemplate(myCustomTemplate);
     * </script>
     *
     * {#snippet myCustomTemplate(args)}
     *     <SomeComponent {...args} />
     * {/snippet}
     *
     * <Story name="Default" />
     * ```
     */
    const setTemplateSnippetBlock = findSetTemplateSnippetBlock({
      svelteASTNodes,
      filename,
    });

    if (setTemplateSnippetBlock) {
      return await getSnippetBlockBodyRawCode(originalCode, setTemplateSnippetBlock);
    }

    /* Case - No `children` attribute provided, no `setTemplate` used, just a Story */
    const defineMetaComponentValue = getDefineMetaComponentValue({
      svelteASTNodes,
      filename,
    });

    // NOTE: It should never be undefined in this particular case, otherwise Storybook wouldn't know what to render.
    return `<${defineMetaComponentValue?.name} {...args} />`;
  }

  /**
   * Case - Story with children - and with a snippet block `children` inside
   *
   * Example:
   *
   * ```svelte
   * <Story name="Default">
   *     {#snippet children(args)}
   *          <SomeComponent {...args} />
   *     {/snippet}
   * </Story>
   * ```
   */
  const storyChildrenSnippetBlock = extractStoryChildrenSnippetBlock(component);

  if (storyChildrenSnippetBlock) {
    return await getSnippetBlockBodyRawCode(originalCode, storyChildrenSnippetBlock);
  }

  /**
   * Case - No inner `children`, just Story with a static content
   *
   * Example:
   *
   * ```svelte
   * <Story name="Default">
   *     <SomeComponent foo="bar" />
   * </Story>
   * ```
   */
  const { fragment } = component;
  const { nodes } = fragment;
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const rawCode = originalCode.slice(firstNode.start, lastNode.end);

  return prettifyCodeSlice(rawCode);
}

function findTemplateSnippetBlock(
  name: string,
  svelteASTNodes: Params['svelteASTNodes']
): SnippetBlock | undefined {
  const { snippetBlocks } = svelteASTNodes;

  return snippetBlocks.find((snippetBlock) => name === snippetBlock.expression.name);
}

function findSetTemplateSnippetBlock(
  params: Pick<Params, 'svelteASTNodes' | 'filename'>
): SnippetBlock | undefined {
  const { svelteASTNodes, filename } = params;
  const { setTemplateCall } = svelteASTNodes;

  if (!setTemplateCall) {
    return;
  }

  if (setTemplateCall.arguments[0].type !== 'Identifier') {
    throw new Error(
      `Invalid schema - expected 'setTemplate' first argument to be an identifier. Stories file: ${filename}`
    );
  }

  return findTemplateSnippetBlock(setTemplateCall.arguments[0].name, svelteASTNodes);
}

function findChildrenPropSnippetBlock(
  component: Component,
  options: Pick<Params, 'svelteASTNodes' | 'filename'>
) {
  const { svelteASTNodes, filename } = options;
  const { children } = extractStoryAttributesNodes({
    component,
    attributes: ['children'],
  });

  if (!children) {
    return;
  }

  const { value } = children;

  if (value === true || value[0].type === 'Text' || value[0].expression.type !== 'Identifier') {
    throw new Error(
      `Invalid schema. Expected '<Story />'s attribute 'children' to be an expression with identifier to snippet block. Stories file: ${filename}`
    );
  }

  return findTemplateSnippetBlock(value[0].expression.name, svelteASTNodes);
}

/**
 * Extract from the original code a string slice with the body of the svelte's snippet block.
 * Starting from the start of the first node, and ending with the end of the last node.
 *
 * For example, from the following case:
 *
 * ```svelte
 * {#snippet children(args)}
 *   <!-- Some comment... -->
 *   "Static text"
 *   <Component {...args } />
 * {/snippet}
 * ```
 *
 * The result would be:
 *
 * ```txt
 * <!-- Some comment... -->
 * "Static text"
 * <Component {...args } />
 * ```
 */
async function getSnippetBlockBodyRawCode(originalCode: string, node: SnippetBlock) {
  const { body } = node;
  const { nodes } = body;
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const rawCode = originalCode.slice(firstNode.start, lastNode.end);

  return await prettifyCodeSlice(rawCode);
}

async function prettifyCodeSlice(rawCode: string) {
  /**
   * FIXME: Perhaps we don't need to prettify the code at this point, and do it at runtime instead?
   */
  return await format(rawCode, {
    plugins: ['prettier-plugin-svelte'],
    parser: 'svelte',
  });
}
