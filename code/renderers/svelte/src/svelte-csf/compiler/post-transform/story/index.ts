import { print } from 'esrap';
import type MagicString from 'magic-string';

import { insertStoryHTMLCommentAsDescription } from './insert-description.js';
import { insertSvelteCSFToStoryParameters } from './insert-svelte-csf.js';

import type { extractStoriesNodesFromExportDefaultFn } from '$lib/parser/extract/compiled/stories.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';

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
  const { start, end } = compiled;

  code.update(start as number, end as number, print(compiled).code);
}
