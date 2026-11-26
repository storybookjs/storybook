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

/**
 * Returns the HTML comment that documents a story: the comment right before the `<Story>`, with only
 * whitespace between them. Returns `undefined` when anything else comes between them, such as an
 * element, a snippet block, or a `<script>` or `<style>` tag.
 */
function commentBefore(
  node: SvelteAST.Component,
  parent: SvelteAST.SvelteNode | undefined
): SvelteAST.Comment | undefined {
  if (parent?.type !== 'Fragment') return undefined;
  const index = parent.nodes.indexOf(node);
  const previous = parent.nodes[index - 1];
  const whitespace = previous?.type === 'Text' && !previous.data.trim() ? previous : undefined;
  const comment = whitespace ? parent.nodes[index - 2] : previous;
  if (comment?.type !== 'Comment') return undefined;
  // Whitespace is a `Text` node of its own, so the nodes of a fragment cover the source with no gaps.
  // The parser leaves `<script>` and `<style>` out of the fragment, so a gap means one of them is
  // between the comment and the story.
  const whitespaceLength = whitespace ? whitespace.end - whitespace.start : 0;
  return node.start - comment.end === whitespaceLength ? comment : undefined;
}
