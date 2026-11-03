import { type ESTreeNode as Node, unwrapExpression } from 'storybook/internal/csf-tools';
import { writtenArg } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { argCode, literalOf } from './build-story-docs.ts';

// The args a story is written with, as the preview fills its template with them before a control
// changes one: each with `argCode` as that code, any other as its value.
export const ownArgs = (args: Record<string, Node>): Args => {
  const code = argCode(args);
  return Object.fromEntries(
    Object.entries(args).map(([name, node]) => [
      name,
      Object.hasOwn(code, name)
        ? writtenArg(code[name]!)
        : literalOf(unwrapExpression(node))!.value,
    ])
  );
};
