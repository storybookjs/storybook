import type { Comment, Component, Fragment, SnippetBlock, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import type { extractModuleNodes } from './module-nodes';
import type { extractInstanceNodes } from './instance-nodes';

interface Result {
  storyComponents: Array<{
    /** Leading HTML comment as AST nodes which can be used as description for the story. */
    comment?: Comment;
    /** '<Story>' component AST node. */
    component: Component;
  }>;
  /**
   * "First level" _(at the root of fragment)_ snippet blocks AST nodes, which can be used for further transformation.
   *
   * For example:
   * Determining the source code of the `<Story />`.
   * Based on either `setTemplate` call,
   * or by passing `children` as prop from the outer Svelte snippet block definition - e.g. `Story children={template1} />`.
   */
  snippetBlocks: SnippetBlock[];
}

interface Params {
  fragment: Fragment;
  filename?: string;
  instanceNodes: Awaited<ReturnType<typeof extractInstanceNodes>>;
  moduleNodes: Awaited<ReturnType<typeof extractModuleNodes>>;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the fragment aka HTML code.
 * They are needed for further code analysis/transformation.
 */
export async function extractFragmentNodes(params: Params): Promise<Result> {
  const { walk } = await import('zimmerframe');

  const { fragment, moduleNodes } = params;
  const { storyIdentifier } = moduleNodes;

  let latestComment: Comment | undefined;

  const state: Result = {
    storyComponents: [],
    snippetBlocks: [],
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

    SnippetBlock(node, { state }) {
      state.snippetBlocks.push(node);
    },
  };

  walk(fragment, state, visitors);

  return state;
}
