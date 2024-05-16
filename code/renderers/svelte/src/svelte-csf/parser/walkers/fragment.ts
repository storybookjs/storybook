import dedent from 'dedent';
import { type Comment, type Root, type SvelteNode } from 'svelte/compiler';
import { walk, type Visitors } from 'zimmerframe';

import { getChildrenRawSource, getStoryId, getStoryName } from './component.js';
import { type FragmentMeta, type InstanceMeta, type StoryMeta } from '../types.js';

/** NOTE: Fragment is the 'html' code - not the one innside `<script>` nor `<style>` */
export function walkOnFragment({
  fragment,
  rawSource,
  addonComponentName,
}: {
  fragment: Root['fragment'];
  rawSource: string;
  addonComponentName: InstanceMeta['addonComponentName'];
}): FragmentMeta {
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
    Component(node, { state, next }) {
      if (node.name === addonComponentName) {
        const { attributes } = node;
        const name = getStoryName(attributes);
        const childrenRawSource = getChildrenRawSource({
          node,
          rawSource,
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
          rawSource: childrenRawSource,
        };

        state.stories[name] = meta;
      }

      latestComment = undefined;
      next();
    },
  };

  walk(fragment, state, visitors);

  return state;
}
