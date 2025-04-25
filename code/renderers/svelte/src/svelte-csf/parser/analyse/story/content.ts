import dedent from 'dedent';

import { getDefineMetaComponentValue } from '$lib/parser/analyse/define-meta/component-identifier.js';
import type { SvelteAST } from '$lib/parser/ast.js';
import type { extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import { extractStoryTemplateSnippetBlock } from '$lib/parser/extract/svelte/story/template.js';
import {
  findSetTemplateSnippetBlock,
  findStoryAttributeTemplateSnippetBlock,
} from '$lib/parser/extract/svelte/snippet-block.js';
import { extractStoryAttributesNodes } from '../../extract/svelte/story/attributes.js';

interface Params {
  nodes: {
    component: SvelteAST.Component;
    svelte: Awaited<ReturnType<typeof extractSvelteASTNodes>>;
  };
  originalCode: string;
  filename?: string;
}

/**
 * Extract the source code of the `<Story />` component content (children or template snippet).
 * Reference: Step 2 from the comment: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2143539873
 */
export function getStoryContentRawCode(params: Params): string {
  const { nodes, originalCode, filename } = params;
  const { component, svelte } = nodes;

  // `<Story />` component is self-closing...
  if (component.fragment.nodes.length === 0) {
    /**
     * Case - "explicit template" - `template` attribute references to a snippet block at the root level of fragment.
     *
     * Example:
     *
     * ```svelte
     * {#snippet template1(args)}
     *     <SomeComponent {...args} />
     * {/snippet}
     *
     * <Story name="Default" template={template1} />
     * ```
     */
    const storyAttributTemplateSnippetBlock = findStoryAttributeTemplateSnippetBlock({
      component,
      nodes: svelte,
      filename,
    });

    if (storyAttributTemplateSnippetBlock) {
      return getSnippetBlockBodyRawCode(originalCode, storyAttributTemplateSnippetBlock);
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
   * Case - Story with children - and with a snippet block `template` inside
   *
   * Example:
   *
   * ```svelte
   * <Story name="Default">
   *     {#snippet template(args)}
   *          <SomeComponent {...args} />
   *     {/snippet}
   * </Story>
   * ```
   */
  const storyChildrenSnippetBlock = extractStoryTemplateSnippetBlock(component);

  if (storyChildrenSnippetBlock) {
    return getSnippetBlockBodyRawCode(originalCode, storyChildrenSnippetBlock);
  }

  /**
   * Case - Inner children used directly with `asChild` attribute
   *
   * Example:
   *
   * ```svelte
   * <Story name="Default" asChild>
   *     <SomeComponent foo="bar" />
   * </Story>
   * ```
   */
  const { asChild } = extractStoryAttributesNodes({
    component,
    attributes: ['asChild'],
  });

  const { fragment } = component;
  const firstNode = fragment.nodes[0];
  const lastNode = fragment.nodes[fragment.nodes.length - 1];
  const rawCode = dedent(originalCode.slice(firstNode.start, lastNode.end));

  if (asChild) {
    return rawCode;
  }

  /**
   * Case - `children` provided as prop to component or template
   *
   * Example:
   *
   * ```svelte
   * <Story name="Default">
   *     <SomeComponent foo="bar" />
   * </Story>
   * ```
   */
  const defineMetaComponentValue = getDefineMetaComponentValue({
    nodes: svelte,
    filename,
  });

  // NOTE: It should never be `undefined` in this particular case, otherwise Storybook wouldn't know what to render.
  return dedent(`<${defineMetaComponentValue?.name} {...args}>
    ${rawCode}
  </${defineMetaComponentValue?.name}>`);
}

/**
 * Extract from the original code a string slice with the body of the svelte's snippet block.
 * Starting from the start of the first node, and ending with the end of the last node.
 *
 * For example, from the following case:
 *
 * ```svelte
 * {#snippet template(args)}
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
function getSnippetBlockBodyRawCode(originalCode: string, node: SvelteAST.SnippetBlock) {
  const { body } = node;
  const { nodes } = body;
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const rawCode = originalCode.slice(firstNode.start, lastNode.end);

  return dedent(rawCode);
}
