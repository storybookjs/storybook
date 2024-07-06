import type { extractLegacyNodes } from '#compiler/pre-transform/extractor';
import { transformTemplateToSnippet } from './codemods/template-to-snippet';
import type MagicString from 'magic-string';

interface Params {
  code: MagicString;
  legacyNodes: Awaited<ReturnType<typeof extractLegacyNodes>>;
}

export async function codemodLegacyNodes(params: Params): Promise<void> {
  const { print } = await import('svelte-ast-print');
  const { legacyNodes, code } = params;
  const { componentsTemplate } = legacyNodes;

  // TODO: use toReversed() when Storybook ends support for v18
  for (const template of [...componentsTemplate].reverse()) {
    const { start, end } = template;
    const snippetBlock = transformTemplateToSnippet(template);

    code.update(start, end, print(snippetBlock));
  }
}
