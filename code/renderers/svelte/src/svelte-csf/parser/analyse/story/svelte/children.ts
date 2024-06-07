import dedent from 'dedent';
import type { Component, SnippetBlock } from 'svelte/compiler';

import { getDefineMetaComponentValue } from '../../define-meta/component-identifier.js';

import type { extractSvelteASTNodes } from '../../../extract/svelte/nodes.js';
import { extractStoryChildrenSnippetBlock } from '../../../extract/svelte/story/children.js';
import {
  findSetTemplateSnippetBlock,
  findStoryAttributeChildrenSnippetBlock,
} from '../../../extract/svelte/snippet-block.js';

interface Params {
  nodes: {
    component: Component;
    svelte: Awaited<ReturnType<typeof extractSvelteASTNodes>>;
  };
  originalCode: string;
  filename?: string;
}

/**
 * Extract the source code of the `<Story />` component children.
 * Reference: Step 2 from the comment: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2143539873
 */
export function getStoryChildrenRawCode(params: Params): string {
  const { nodes, originalCode, filename } = params;
  const { component, svelte } = nodes;

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
    const storyAttributeChildrenSnippetBlock = findStoryAttributeChildrenSnippetBlock({
      component,
      nodes: svelte,
      filename,
    });

    if (storyAttributeChildrenSnippetBlock) {
      return getSnippetBlockBodyRawCode(originalCode, storyAttributeChildrenSnippetBlock);
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
      nodes: svelte,
      filename,
    });

    if (setTemplateSnippetBlock) {
      return getSnippetBlockBodyRawCode(originalCode, setTemplateSnippetBlock);
    }

    /* Case - No `children` attribute provided, no `setTemplate` used, just a Story */
    const defineMetaComponentValue = getDefineMetaComponentValue({
      nodes: svelte,
      filename,
    });

    // NOTE: It should never be `undefined` in this particular case, otherwise Storybook wouldn't know what to render.
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
    return getSnippetBlockBodyRawCode(originalCode, storyChildrenSnippetBlock);
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
  const firstNode = fragment.nodes[0];
  const lastNode = fragment.nodes[fragment.nodes.length - 1];
  const rawCode = originalCode.slice(firstNode.start, lastNode.end);

  return dedent(rawCode);
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
function getSnippetBlockBodyRawCode(originalCode: string, node: SnippetBlock) {
  const { body } = node;
  const { nodes } = body;
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const rawCode = originalCode.slice(firstNode.start, lastNode.end);

  return dedent(rawCode);
}
