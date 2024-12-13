import type { SvelteAST } from '$lib/parser/ast';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes';
import { extractStoryAttributesNodes } from '$lib/parser/extract/svelte/story/attributes';

import {
  InvalidSetTemplateFirstArgumentError,
  InvalidStoryChildrenAttributeError,
} from '$lib/utils/error/parser/extract/svelte';

/**
 * Svelte 5 allows to passing `children` as attribute _(aka prop)_.
 *
 * For example:
 *
 * ```svelte
 * {#snippet myTemplate()}
 *   <SomeComponent color="red" />
 * {/snippet}
 * <Story children={myTemplate} />
 * ```
 *
 * This function attempts to extract the AST node of the snippet block from the root fragment of `*.svelte` file,
 * which was referenced by the attribute `children`. Following example above - it would be snippet `myTemplate`.
 */
export function findStoryAttributeChildrenSnippetBlock(options: {
  component: SvelteAST.Component;
  nodes: SvelteASTNodes;
  filename?: string;
}) {
  const { component, nodes, filename } = options;
  const { children } = extractStoryAttributesNodes({
    component,
    attributes: ['children'],
  });

  if (!children) {
    return;
  }

  const { value } = children;

  if (value === true) {
    throw new InvalidStoryChildrenAttributeError({
      component: component,
      childrenAttribute: children,
      filename,
    });
  }

  // value is SvelteAST.ExpressionTag
  if (!Array.isArray(value)) {
    if (value.expression.type !== 'Identifier') {
      throw new InvalidStoryChildrenAttributeError({
        component: component,
        childrenAttribute: children,
        filename,
      });
    }

    return findSnippetBlockByName({
      name: value.expression.name,
      nodes: nodes,
    });
  }

  // value is Array<SvelteAST.ExpressionTag | SvelteAST.Text> - I haven't figured out when it would happen
  if (value[0].type !== 'ExpressionTag') {
    throw new InvalidStoryChildrenAttributeError({
      component: component,
      childrenAttribute: children,
      filename,
    });
  }

  return findSnippetBlockByName({
    name: value[0].expression.name,
    nodes: nodes,
  });
}

/**
 * Find and extract the AST node of snippet block used by `setTemplate` call in the instance module.
 * It uses first argument from `setTemplate` call.
 *
 * For example:
 *
 * ```js
 * <script>
 *   setTemplate(myCustomTemplate);
 * </script>
 * ```
 *
 * Where `myCustomTemplate` is a identifier with a hoisted reference to the snippet block,
 * which should exist at the root fragment of `*.svelte` file.
 */
export function findSetTemplateSnippetBlock(options: {
  nodes: SvelteASTNodes;
  filename?: string;
}): SvelteAST.SnippetBlock | undefined {
  const { nodes, filename } = options;
  const { setTemplateCall } = nodes;

  if (!setTemplateCall) {
    return;
  }

  if (setTemplateCall.arguments[0].type !== 'Identifier') {
    throw new InvalidSetTemplateFirstArgumentError({
      setTemplateCall,
      filename,
    });
  }

  return findSnippetBlockByName({
    name: setTemplateCall.arguments[0].name,
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
   * For example, from the following: `{#snippet children(args)}` - `children`
   */
  name: string;
  nodes: SvelteASTNodes;
}): SvelteAST.SnippetBlock | undefined {
  const { name, nodes } = options;
  const { snippetBlocks } = nodes;

  return snippetBlocks.find((snippetBlock) => snippetBlock.expression.name === name);
}
