import type { Component, SnippetBlock } from 'svelte/compiler';

import type { SvelteASTNodes } from './nodes.js';
import { extractStoryAttributesNodes } from './Story/attributes.js';

/**
 * Svelte 5 allows to passing `children` as attribute _(aka prop)_.
 *
 * For example:
 *
 * ```svelte
 * {#snippet myTemplate()}
 *   <SomeComponent color="red" />
 * {/snippet}
 *
 * <Story children={myTemplate} />
 * ```
 *
 * This function attempts to extract the AST node of the snippet block from the root fragment of `*.svelte` file,
 * which was referenced by the attribute `children`. Following example above - it would be snippet `myTemplate`.
 */
export function findStoryAttributeChildrenSnippetBlock(options: {
  component: Component;
  svelteASTNodes: SvelteASTNodes;
  filename?: string;
}) {
  const { component, svelteASTNodes, filename } = options;
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
      `Invalid schema. Expected '<Story />'s attribute 'children' to be an expression with identifier to existing snippet block. Stories file: ${filename}`
    );
  }

  return findSnippetBlockByName({
    name: value[0].expression.name,
    svelteASTNodes,
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
  svelteASTNodes: SvelteASTNodes;
  filename?: string;
}): SnippetBlock | undefined {
  const { svelteASTNodes, filename } = options;
  const { setTemplateCall } = svelteASTNodes;

  if (!setTemplateCall) {
    return;
  }

  if (setTemplateCall.arguments[0].type !== 'Identifier') {
    throw new Error(
      `Invalid schema. Expected 'setTemplate' first argument to be an identifier to existing snippet block. Stories file: ${filename}`
    );
  }

  return findSnippetBlockByName({
    name: setTemplateCall.arguments[0].name,
    svelteASTNodes,
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
  svelteASTNodes: SvelteASTNodes;
}): SnippetBlock | undefined {
  const { name, svelteASTNodes } = options;
  const { snippetBlocks } = svelteASTNodes;

  return snippetBlocks.find((snippetBlock) => snippetBlock.expression.name === name);
}
