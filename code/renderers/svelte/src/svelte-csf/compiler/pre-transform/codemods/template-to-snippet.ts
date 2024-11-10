import { getStringValueFromAttribute } from '#parser/analyse/story/attributes';
import type { SvelteAST } from '#parser/ast';

interface Params {
  component: SvelteAST.Component;
}

/**
 *
 * Codemod to transform AST node of `<Template>` component to `SnippetBlock`
 *
 * Two cases to cover:
 *
 * @example 1. without provided `id` prop _(attribute)_
 * ```diff
 * - <Template let:args let:context>
 * + {#snippet template(args, context)}
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
export function transformTemplateToSnippet(params: Params): SvelteAST.SnippetBlock {
  const { component } = params;
  const { attributes, fragment } = component;

  const attributeId = attributes.find((attr) => {
    return attr.type === 'Attribute' && attr.name === 'id';
  }) as SvelteAST.Attribute | undefined;

  const id = getStringValueFromAttribute({
    node: attributeId,
    component,
  });

  const letDirectiveArgs = attributes.find((attr) => {
    return attr.type === 'LetDirective' && attr.name === 'args';
  }) as SvelteAST.LetDirective | undefined;

  const letDirectiveContext = attributes.find((attr) => {
    return attr.type === 'LetDirective' && attr.name === 'context';
  }) as SvelteAST.LetDirective | undefined;

  let parameters: SvelteAST.SnippetBlock['parameters'] = [];

  if (letDirectiveArgs || letDirectiveContext) {
    parameters.push({
      type: 'Identifier',
      name: letDirectiveArgs ? 'args' : '_args',
    });
  }

  if (letDirectiveContext) {
    parameters.push({
      type: 'Identifier',
      name: 'context',
    });
  }

  return {
    type: 'SnippetBlock',
    expression: {
      type: 'Identifier',
      name: id ?? 'sb_default_template',
    },
    parameters,
    body: fragment,
  };
}
