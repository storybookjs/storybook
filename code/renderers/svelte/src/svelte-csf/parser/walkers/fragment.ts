import dedent from 'dedent';
import { type Comment, type Component, type Root, type SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import {
  getBooleanFromAttribute,
  getChildrenRawSource,
  getStoryId,
  getStoryName,
  getStringFromAttribute,
} from './component.js';
import { type AddonASTNodes, type FragmentMeta, type StoryMeta } from '../types.js';

/**
 * NOTE: Fragment is the 'html' code - not the one innside `<script>` nor `<style>`
 */
export async function walkOnFragment({
  fragment,
  source,
  nodes,
}: {
  fragment: Root['fragment'];
  source: string;
  nodes: AddonASTNodes;
}): Promise<FragmentMeta> {
  const { walk } = await import('zimmerframe');

  const state: FragmentMeta = {
    stories: {},
  };
  let latestComment: Comment | undefined;

  const storiesIds = new Set<string>(Object.keys(state.stories));
  const visitors: Visitors<SvelteNode, typeof state> = {
    Comment(node, { next }) {
      latestComment = node;
      next();
    },

    Component(node, { state }) {
      if (node.name === nodes.Story.name) {
        const { attributes } = node;
        const name = getStoryName(attributes);
        const sourceAttribute = getSourceAttribute(attributes);
        const childrenRawSource = getChildrenRawSource({
          node,
          rawSource: source,
        });
        const id = getStoryId({ attributes, name, storiesIds: storiesIds });
        const description =
          latestComment && latestComment.end === node.start - 1
            ? dedent`${latestComment?.data}`
            : undefined;

        const meta: StoryMeta = {
          id,
          name,
          description,
          source: sourceAttribute,
          rawSource: childrenRawSource,
        };

        state.stories[name] = meta;
      }

      latestComment = undefined;
    },
  };

  walk(fragment, state, visitors);

  return state;
}

function getSourceAttribute(attributes: Component['attributes']) {
  const name = 'source';
  let value: boolean | string | undefined;

  try {
    value = getBooleanFromAttribute(name, attributes);
  } catch {
    value = getStringFromAttribute(name, attributes);
  }

  return value;
}
