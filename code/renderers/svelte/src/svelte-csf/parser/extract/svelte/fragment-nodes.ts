import type { Comment, Component, Fragment, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import type { extractModuleNodes } from './module-nodes.js';

interface Result {
  storyComponents: Array<{
    comment?: Comment;
    component: Component;
  }>;
}

interface Params {
  fragment: Fragment;
  filename?: string;
  moduleNodes: Awaited<ReturnType<typeof extractModuleNodes>>;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the fragment aka HTML code.
 * They are needed for further code analysis/transformation.
 */
export async function extractFragmentNodes(params: Params): Promise<Result> {
  const { walk } = await import('zimmerframe');

  const { fragment, filename, moduleNodes } = params;
  const { storyIdentifier } = moduleNodes;

  let latestComment: Comment | undefined;

  const state: Result = {
    storyComponents: [],
  };

  const visitors: Visitors<SvelteNode, typeof state> = {
    Comment(node, { next }) {
      latestComment = node;
      next();
    },

    Component(node, { state }) {
      if (node.name === storyIdentifier.name) {
        state.storyComponents.push({
          comment: latestComment,
          component: node,
        });
        latestComment = undefined;
      }
    },
  };

  walk(fragment, state, visitors);

  return state;
}
