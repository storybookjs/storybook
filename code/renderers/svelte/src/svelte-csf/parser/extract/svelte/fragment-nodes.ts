import type { Comment, Component, Fragment, SnippetBlock, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import type { extractModuleNodes } from './module-nodes.js';
import type { extractInstanceNodes } from './instance-nodes.js';

interface Result {
  storyComponents: Array<{
    comment?: Comment;
    component: Component;
  }>;
  setTemplateSnippetBlock: SnippetBlock | undefined;
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

  const { fragment, filename, moduleNodes, instanceNodes } = params;
  const { setTemplateCall } = instanceNodes;
  const { storyIdentifier } = moduleNodes;

  let latestComment: Comment | undefined;

  const state: Result = {
    storyComponents: [],
    setTemplateSnippetBlock: undefined,
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
      if (
        setTemplateCall &&
        setTemplateCall.arguments[0].type === 'Identifier' &&
        setTemplateCall.arguments[0].name === node.expression.name
      ) {
        state.setTemplateSnippetBlock = node;
      }
    },
  };

  walk(fragment, state, visitors);

  return state;
}
