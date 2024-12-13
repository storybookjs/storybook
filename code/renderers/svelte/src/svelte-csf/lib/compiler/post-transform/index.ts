import type MagicString from 'magic-string';

import { transformStory } from './story';
import { transformDefineMeta } from './define-meta';
import { removeExportDefault } from './remove-export-default';
import { createAppendix } from './create-appendix';

import type { CompiledASTNodes } from '$lib/parser/extract/compiled/nodes';
import { extractStoriesNodesFromExportDefaultFn } from '$lib/parser/extract/compiled/stories';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes';

interface Params {
  code: MagicString;
  nodes: {
    svelte: SvelteASTNodes;
    compiled: CompiledASTNodes;
  };
  filename?: string;
  originalCode: string;
}

/**
 * Updates the {@link MagicString} code with necessary transformations for this addon to work correctly.
 */
export async function transformStoriesCode(params: Params): Promise<void> {
  const { code, nodes, filename, originalCode } = params;

  const extractedCompiledStoriesNodes = await extractStoriesNodesFromExportDefaultFn({
    nodes: nodes.compiled,
    filename,
  });
  const svelteStories = [...nodes.svelte.storyComponents].reverse();
  const compiledStories = [...extractedCompiledStoriesNodes].reverse();

  /*
   * WARN:
   * IMPORTANT! The plugins starts updating the compiled output code from the bottom.
   * Why? Because once we start updating nodes in the stringified output from the top,
   * then other nodes' `start` and `end` numbers will not be correct anymore.
   * Hence the reason why reversing both arrays with stories _(svelte and compiled)_.
   */
  compiledStories.forEach((compiled, index) => {
    transformStory({
      code,
      nodes: {
        component: { svelte: svelteStories[index], compiled },
        svelte: nodes.svelte,
      },
      filename,
      originalCode,
    });
  });
  transformDefineMeta({
    code,
    nodes,
    filename,
  });
  removeExportDefault({
    code,
    nodes: nodes.compiled,
    filename,
  });
  await createAppendix({
    code,
    nodes,
    filename,
  });
}
