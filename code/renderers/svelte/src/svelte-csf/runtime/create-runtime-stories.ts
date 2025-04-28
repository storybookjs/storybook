/* eslint-env browser */
import type { StoryObj } from '@storybook/svelte';
import { mount, unmount, type Component } from 'svelte';

import type { StoriesRepository } from '$lib/runtime/contexts/extractor.svelte';
import type { Cmp, Meta } from '$lib/types.js';

import StoriesExtractor from './StoriesExtractor.svelte';
import StoryRenderer from './StoryRenderer.svelte';

const createFragment = document.createDocumentFragment
  ? () => document.createDocumentFragment()
  : () => document.createElement('div');

/**
 * @module
 * Called from a bundler.
 *
 * It mounts the Stories components in a context which disables
 * the rendering of every `<Story />`,
 * but instead collects names and properties.
 *
 * For every discovered `<Story />`, it creates a `StoryFn` which
 * instantiate the main Stories component: Every Story but
 * the one selected is disabled.
 */
export const createRuntimeStories = (Stories: Component, meta: Meta<Cmp>) => {
  const repository: StoriesRepository<Cmp> = {
    stories: new Map(),
  };

  try {
    const context = mount(StoriesExtractor, {
      target: createFragment() as Element,
      props: {
        Stories,
        repository: () => repository,
      },
    });

    unmount(context);
  } catch (e: any) {
    console.error(`Error in mounting stories ${e.toString()}`, e);
  }

  const stories: Record<string, StoryObj<typeof StoryRenderer>> = {};

  for (const [exportName, story] of repository.stories) {
    const storyObj: StoryObj<typeof StoryRenderer> = {
      ...story,
      // @ts-expect-error WARN: Here we are attempting to convert every `StoryCmp` into `StoryObj`, and the types are different
      render: (args, storyContext) => ({
        Component: StoryRenderer,
        props: {
          exportName,
          Stories,
          storyContext,
          args,
          metaRenderSnippet: meta.render,
        },
      }),
    };

    const play = meta.play ?? story.play;

    if (play) {
      /*
       * The 'play' function should be delegated to the real play Story function
       * in order to be run into the component scope.
       */
      storyObj.play = (storyContext) => {
        const delegate = storyContext.playFunction?.__play;

        if (delegate) {
          return delegate(storyContext);
        }

        // @ts-expect-error WARN: It should not affect user perspective- the problem lies in this addon's type `SvelteRenderer` missing type constrains or default generic parameter type
        return play(storyContext);
      };
    }

    stories[exportName] = storyObj;
  }

  if (!meta.parameters) {
    meta.parameters = {};
  }

  if (!meta.parameters.controls) {
    meta.parameters.controls = {};
  }

  // Inserts https://storybook.js.org/docs/essentials/controls#disablesavefromui
  // Ref: https://github.com/storybookjs/addon-svelte-csf/issues/240
  // TODO: Restore this feature
  meta.parameters.controls.disableSaveFromUI = true;

  return stories;
};
