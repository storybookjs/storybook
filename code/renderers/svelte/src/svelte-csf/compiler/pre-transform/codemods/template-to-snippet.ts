import { getStringValueFromAttribute } from '#parser/analyse/story/attributes';
import type { Attribute, Component, SnippetBlock } from 'svelte/compiler';

/**
 *
 * Codemod to transform AST node of `<Template>` component to `SnippetBlock`
 *
 * Two cases to cover:
 *
 * @example 1. without provided `id` prop _(attribute)_
 * ```diff
 * - <Template let:args let:context>
 * + {#snippet children(args, context)}
 *     <!-- fragment -> body -->
 * + {/snippet}
 * - </Template>
 * ```
 *
 * @example 2. with provided `id` prop _(attribute)_
 * ```diff
 * - <Template id="coolTemplate" let:args let:context>
 * + {#snippet coolTemplate(args, context)}
 *     <!-- fragment -> body -->
 * + {/snippet}
 * - </Template>
 * ```
 */
export function transformTemplateToSnippet(component: Component): SnippetBlock {
  const { attributes, fragment, parent, start, end } = component;

  const attributeId = attributes.find((attr) => {
    if (attr.type === 'Attribute') {
      return attr.name === 'id';
    }
    // Will TypeScript 5.5 handle type inference for this one better? 🤔
  }) as Attribute | undefined;

  const id = getStringValueFromAttribute({
    node: attributeId,
    component,
  });

  return {
    type: 'SnippetBlock',
    expression: {
      type: 'Identifier',
      name: id ?? 'children',
    },
    // WARN: I suspect at this point, it doesn't matter if user used one of directives `let:args` and `let:context`.
    // W provide both parameters, just in case.
    parameters: [
      {
        type: 'Identifier',
        name: 'args',
      },
      {
        type: 'Identifier',
        name: 'storyContext',
      },
    ],
    body: fragment,
    // NOTE: Those are useless, but I want TypeScript to 🤫
    start,
    parent,
    end,
  };
}
