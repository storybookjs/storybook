import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';

import { insertStoryHTMLCommentAsDescription } from './insert-description';
import { insertSvelteCSFToStoryParameters } from './insert-svelte-csf';

import type { extractStoriesNodesFromExportDefaultFn } from '#parser/extract/compiled/stories';
import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';

interface Params {
  code: MagicString;
  nodes: {
    component: {
      svelte: SvelteASTNodes['storyComponents'][number];
      compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
    };
    svelte: SvelteASTNodes;
  };
  filename?: string;
  originalCode: string;
}

/**
 * Transform compiled `<Story />` component when necessary,
 * and print updated AST node of compiled version to original raw source code {@link MagicString}.
 */
export function transformStory(params: Params): void {
  const { code, nodes, filename, originalCode } = params;
  const { component } = nodes;

  insertStoryHTMLCommentAsDescription({
    nodes: component,
    filename,
  });
  insertSvelteCSFToStoryParameters({
    nodes,
    filename,
    originalCode,
  });

  const { compiled } = component;
  // @ts-expect-error FIXME: These keys exists at runtime, perhaps I missed some type extension from `svelte/compiler`?
  const { start, end } = compiled;

  code.update(start, end, toJs(compiled as unknown as Program).value);
}
