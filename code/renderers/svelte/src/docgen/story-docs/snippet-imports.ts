import {
  buildImportStatements,
  resolveComponentImport,
  type ImportBinding,
} from 'storybook/internal/csf-tools';
import { parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';
import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';

export function buildSnippetImportBlock(
  markup: string,
  {
    bindings,
    importOverride,
  }: {
    bindings: Map<string, ImportBinding>;
    importOverride?: string;
  }
): { block?: string; unresolved: string[] } {
  const names = new Set<string>();
  const ast = parse(markup, { modern: true });
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    Component(node, { next }) {
      names.add(node.name);
      next();
    },
  });
  const refs = [...names].map((name) => resolveComponentImport(name, bindings));
  const statements = buildImportStatements({
    refs: refs.map((ref) => ({ ...ref, importOverride })),
  });
  const unresolved = refs.filter((ref) => !ref.importId).map((ref) => ref.componentName);
  return {
    ...(statements.length > 0
      ? {
          block: `<script>\n${statements.map((statement) => `  ${statement}`).join('\n')}\n</script>`,
        }
      : {}),
    unresolved,
  };
}
