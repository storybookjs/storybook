import type { SvelteAST } from '$lib/parser/ast.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';
import { extractStoryAttributesNodes } from '$lib/parser/extract/svelte/story/attributes.js';

import { InvalidStoryTemplateAttributeError } from '$lib/utils/error/parser/extract/svelte.js';
import { getDefineMetaRenderValue } from '../../analyse/define-meta/render-identifier.js';

/**
 * For example:
 *
 * ```svelte
 * {#snippet myTemplate()}
 *   <SomeComponent color="red" />
 * {/snippet}
 * <Story template={myTemplate} />
 * ```
 *
 * This function attempts to extract the AST node of the snippet block from the root fragment of `*.svelte` file,
 * which was referenced by the attribute `template`. Following example above - it would be snippet `myTemplate`.
 */
export function findStoryAttributeTemplateSnippetBlock(options: {
  component: SvelteAST.Component;
  nodes: SvelteASTNodes;
  filename?: string;
}): SvelteAST.SnippetBlock | undefined {
  const { component, nodes, filename } = options;
  const { template } = extractStoryAttributesNodes({
    component,
    attributes: ['template'],
  });

  if (!template) {
    return;
  }

  if (template.value === true || Array.isArray(template.value)) {
    throw new InvalidStoryTemplateAttributeError({
      component: component,
      templateAttribute: template,
      filename,
    });
  }

  return findSnippetBlockByName({
    name: template.value.expression.name,
    nodes: nodes,
  });
}


/**
 * Find and extract the AST node of snippet block referenced with `render` in `defineMeta`.
 *
 * For example:
 *
 * ```svelte
 * <script>
 *   import { defineMeta } from "@storybook/addon-svelte-csf";
 *
 *   const { Story } = defineMeta({
 *     render: myCustomTemplate,
 *   });
 * </script>
 *
 * {#snippet myCustomTemplate()}
 *   ...
 * {/snippet}
 *
 * <Story />
 * ```
 */
export function findMetaRenderSnippetBlock(options: {
  nodes: SvelteASTNodes;
  filename?: string;
}): SvelteAST.SnippetBlock | undefined {
  const { nodes, filename } = options;

  const defineMetaRenderValue = getDefineMetaRenderValue({
    nodes,
    filename,
  });

  if (!defineMetaRenderValue) {
    return;
  }

  return findSnippetBlockByName({
    name: defineMetaRenderValue.name,
    nodes: nodes,
  });
}

/**
 * Find AST node of the snippet block from the root of fragment of `*.svelte`.
 * It uses first argument which is an identifier with reference to the snippet block,
 * which should exist at the root fragment of `*.svelte` file.
 */
function findSnippetBlockByName(options: {
  /**
   * Snippet's block expression name to find by.
   * For example, from the following: `{#snippet template(args)}` - `template`
   */
  name: string;
  nodes: SvelteASTNodes;
}): SvelteAST.SnippetBlock | undefined {
  const { name, nodes } = options;
  const { snippetBlocks } = nodes;

  return snippetBlocks.find((snippetBlock) => snippetBlock.expression.name === name);
}
