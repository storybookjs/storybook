import { print } from 'esrap';
import type MagicString from 'magic-string';

import { destructureMetaFromDefineMeta } from './destructure-meta';
import { insertDefineMetaJSDocCommentAsDescription } from './insert-description';

import type { CompiledASTNodes } from '#parser/extract/compiled/nodes';
import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';

interface Params {
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename?: string;
}

/**
 * Attempt to transform compiled `defineMeta()` when necessary.
 * And in the end, update the compiled code using {@link MagicString}.
 */
export function transformDefineMeta(params: Params): void {
  const { code, nodes, filename } = params;

  destructureMetaFromDefineMeta({
    nodes: nodes.compiled,
    filename,
  });
  insertDefineMetaJSDocCommentAsDescription({
    nodes,
    filename,
  });

  const { compiled } = nodes;
  const { defineMetaVariableDeclaration } = compiled;
  const { start, end } = defineMetaVariableDeclaration;

  code.update(start as number, end as number, print(defineMetaVariableDeclaration).code);
}
