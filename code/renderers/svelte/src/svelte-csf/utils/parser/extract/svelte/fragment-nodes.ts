import type { Comment, Component, Fragment, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

const AST_NODES_NAMES = {
  Story: 'Story',
} as const;

interface SvelteASTNodesFragment {
  /**
   */
  storyComponents: Array<{
    comment?: Comment;
    component: Component;
  }>;
}

interface ExtractModuleNodesOptions {
  fragment: Fragment;
  filename: string;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the fragment aka HTML code.
 * They are needed for further code analysis/transformation.
 */
export async function extractFragmentNodes(
  options: ExtractModuleNodesOptions
): Promise<SvelteASTNodesFragment> {
  const { fragment, filename: _ } = options;

  const { walk } = await import('zimmerframe');

  let latestComment: Comment | undefined;

  const state: SvelteASTNodesFragment = {
    storyComponents: [],
  };

  const visitors: Visitors<SvelteNode, typeof state> = {
    Comment(node, { next }) {
      latestComment = node;
      next();
    },

    Component(node, { state }) {
      if (node.name === AST_NODES_NAMES.Story) {
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
