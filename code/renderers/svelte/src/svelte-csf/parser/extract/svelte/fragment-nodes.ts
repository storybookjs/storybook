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

  const state: Result = {
    storyComponents: [],
    snippetBlocks: [],
  };

  const visitors: Visitors<SvelteAST.SvelteNode, typeof state> = {
    Component(node, { state, path }) {
      if (storyNames.includes(node.name)) {
        state.storyComponents.push({
          comment: commentBefore(node, path.at(-1)),
          component: node,
        });
      }
    },

    SnippetBlock(node, { state }) {
      state.snippetBlocks.push(node);
    },
  };

  walk(fragment, state, visitors);

  return state;
}

// The comment that a story directly follows, with only whitespace between them. The fragment leaves
// out `<script>` and `<style>`, so a gap between two siblings means one of them was there.
function commentBefore(
  node: SvelteAST.Component,
  parent: SvelteAST.SvelteNode | undefined
): SvelteAST.Comment | undefined {
  if (parent?.type !== 'Fragment') return undefined;
  let next: { start: number } = node;
  for (let index = parent.nodes.indexOf(node) - 1; index >= 0; index--) {
    const sibling = parent.nodes[index];
    if (sibling.end !== next.start) return undefined;
    if (sibling.type === 'Comment') return sibling;
    if (sibling.type !== 'Text' || sibling.data.trim()) return undefined;
    next = sibling;
  }
  return undefined;
}
