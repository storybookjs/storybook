import type { Component, SnippetBlock } from 'svelte/compiler';

import { extractStoryChildrenSnippetBlock } from '../../../parser/extract/svelte/Story/children.js';
import type { extractFragmentNodes } from 'src/parser/extract/svelte/fragment-nodes.js';

interface Params {
  component: Component;
  setTemplateSnippetBlock: Awaited<
    ReturnType<typeof extractFragmentNodes>
  >['setTemplateSnippetBlock'];
  originalCode: string;
}

/**
 * Determine the `source.code` of the `<Story />` component children.
 * Reference: Step 2 from the comment: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2143539873
 */
export function getStoryChildrenRawSource(params: Params): string {
  const { component, setTemplateSnippetBlock, originalCode } = params;
  const storyChildrenSnippetBlock = extractStoryChildrenSnippetBlock(component);

  /* Case 1 - No template, no children, just Story */
  if (
    component.fragment.nodes.length === 0 &&
    !storyChildrenSnippetBlock &&
    !setTemplateSnippetBlock
  ) {
    // TODO: How do we fill ComponentName? Extract from defineMeta? - it can be optional
    return `<[ComponentName] {...args} />`;
  }

  /* Case 2 - No template, just Story with static content */
  if (
    component.fragment.nodes.length > 0 &&
    !storyChildrenSnippetBlock &&
    !setTemplateSnippetBlock
  ) {
    const { fragment } = component;
    const { nodes } = fragment;
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];

    return originalCode.slice(firstNode.start, lastNode.end);
  }

  /* Case 3 - No template, Story with snippet content */
  if (storyChildrenSnippetBlock) {
    return getSnippetBlockBodyRawCode(originalCode, storyChildrenSnippetBlock);
  }

  /* Case 4 - Explicit template as children */
  // TODO: Might need to collect all the existing snippets blocks in the `*.stories.svelte`

  /* Case 5 - Implicit template via `setTemplate` */
  if (setTemplateSnippetBlock) {
    return getSnippetBlockBodyRawCode(originalCode, setTemplateSnippetBlock);
  }

  // TODO: To throw or not to throw - when we reach an unhandled case?
  return '';
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

  return originalCode.slice(firstNode.start, lastNode.end);
}
