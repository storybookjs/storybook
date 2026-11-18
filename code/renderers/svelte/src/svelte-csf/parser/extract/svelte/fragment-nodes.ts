import type { Visitors } from 'zimmerframe';

import type { extractModuleNodes } from './module-nodes.ts';

import type { SvelteAST } from '../../ast.ts';

interface Result {
  storyComponents: Array<{
    // The HTML comment right before the story, used as its description
    comment?: SvelteAST.Comment;
    component: SvelteAST.Component;
  }>;
  // Snippet blocks at the root of the fragment, which `<Story template={...}>` can reference
  snippetBlocks: SvelteAST.SnippetBlock[];
}

interface Params {
  fragment: SvelteAST.Fragment;
  filename?: string;
  moduleNodes: Awaited<ReturnType<typeof extractModuleNodes>>;
}

export async function extractFragmentNodes(params: Params): Promise<Result> {
  const { walk } = await import('zimmerframe');

  const { fragment, moduleNodes } = params;
  const { storyNames } = moduleNodes;

  let latestComment: SvelteAST.Comment | undefined;

  const state: Result = {
    storyComponents: [],
    snippetBlocks: [],
  };

  const visitors: Visitors<SvelteAST.SvelteNode, typeof state> = {
    Comment(node, { next }) {
      latestComment = node;
      next();
    },

    Component(node, { state }) {
      if (storyNames.includes(node.name)) {
        state.storyComponents.push({
          comment: latestComment,
          component: node,
        });
        latestComment = undefined;
      }
    },

    SnippetBlock(node, { state }) {
      state.snippetBlocks.push(node);
    },
  };

  walk(fragment, state, visitors);

  return state;
}
