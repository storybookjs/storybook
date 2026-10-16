import { parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';

import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';

export function resolveSpreadOverrides(code: string, argNames: ReadonlySet<string>) {
  const spreads = new Map<number, ReadonlySet<string>>();
  const replacements = new Map<number, { end: number; code: string }>();
  const ast = parse(code, { modern: true });
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    SpreadAttribute(node, { path }) {
      if (node.expression.type !== 'Identifier' || node.expression.name !== 'args') return;
      const parent = path.at(-1);
      if (!parent || !('attributes' in parent)) return;
      const names = new Set<string>();
      for (const attribute of parent.attributes) {
        if (attribute.type !== 'Attribute' && attribute.type !== 'BindDirective') continue;
        names.add(attribute.name);
        if (
          attribute.type === 'Attribute' &&
          attribute.start < node.start &&
          argNames.has(attribute.name)
        ) {
          replacements.set(attribute.start, {
            end: attribute.end,
            code: `${attribute.name}={args[${JSON.stringify(attribute.name)}]}`,
          });
        }
      }
      spreads.set(node.start, names);
    },
  });
  for (const [start, replacement] of [...replacements].sort(([a], [b]) => b - a)) {
    code = code.slice(0, start) + replacement.code + code.slice(replacement.end);
  }
  return { code, omissions: [...spreads].sort(([a], [b]) => a - b).map(([, names]) => names) };
}
