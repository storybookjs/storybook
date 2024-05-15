import { logger } from '@storybook/client-logger';
import { type Root, type SvelteNode } from 'svelte/compiler';
import { walk, type Visitors } from 'zimmerframe';

import {
  getDescription,
  getStoryId,
  getStoryName,
  getStoryTemplateId,
} from './components/story.js';
import { getComponentChildrenRawSource } from './components/shared.js';
import { getTemplateId } from './components/template.js';
import {
  type FragmentMeta,
  type InstanceMeta,
  type StoryMeta,
  type TemplateMeta,
} from '../types.js';

/** NOTE: Fragment is the 'html' code - not the one innside `<script>` nor `<style>` */
export function walkOnFragment({
  fragment,
  rawSource,
  addonComponents,
}: {
  fragment: Root['fragment'];
  rawSource: string;
  addonComponents: InstanceMeta['addonComponents'];
}): FragmentMeta {
  const state: FragmentMeta = {
    templates: {},
    stories: {},
  };
  const templatesIds = new Set<string>(Object.keys(state.templates));
  const storiesIds = new Set<string>(Object.keys(state.stories));
  const visitors: Visitors<SvelteNode, typeof state> = {
    Component(node, { state, next }) {
      if (node.name === addonComponents['Template']) {
        const { attributes } = node;
        const childrenRawSource = getComponentChildrenRawSource({
          node,
          rawSource,
        });
        const id = getTemplateId(attributes) ?? 'default';

        if (templatesIds.has(id)) {
          logger.error(`You're overriding the previous <Template id="${id}">`);
        } else {
          templatesIds.add(id);
        }

        const description = getDescription(node);
        const meta: TemplateMeta = {
          id,
          description,
          rawSource: childrenRawSource,
        };

        state.templates[id] = meta;
      }

      if (node.name === addonComponents['Story']) {
        const { attributes } = node;
        const name = getStoryName(attributes);
        const childrenRawSource = getComponentChildrenRawSource({
          node,
          rawSource,
        });
        const templateId = getStoryTemplateId({
          attributes,
          hasChildren: Boolean(childrenRawSource),
        });
        const id = getStoryId({ attributes, name, storiesIds: storiesIds });
        const description = getDescription(node);
        const meta: StoryMeta = {
          id,
          name,
          templateId,
          description,
          rawSource: childrenRawSource,
        };

        state.stories[name] = meta;
      }

      next();
    },
  };

  walk(fragment, state, visitors);

  return state;
}
