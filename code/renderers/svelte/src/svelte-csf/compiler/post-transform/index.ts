import type MagicString from 'magic-string';

import { transformStory } from './story/index.ts';
import { transformDefineMeta } from './define-meta/index.ts';
import { removeExportDefault } from './remove-export-default.ts';
import { createAppendix } from './create-appendix.ts';

import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.ts';
import { extractStoriesNodesFromExportDefaultFn } from '../../parser/extract/compiled/stories.ts';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes.ts';
import {
  getExtendableStories,
  getStoryContent,
  getStoryParents,
} from '../../parser/analyse/story/extend.ts';

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
  const stories = getExtendableStories(nodes.svelte, filename);
  const parents = getStoryParents({ stories, isFactory: nodes.svelte.isFactory, filename });
  const svelteStories = [...nodes.svelte.storyComponents].reverse();
  const contents = stories
    .map(({ exportName }) => getStoryContent(stories, parents, exportName))
    .reverse();
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
        content: contents[index],
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
    stories,
    parents,
    filename,
  });
}
