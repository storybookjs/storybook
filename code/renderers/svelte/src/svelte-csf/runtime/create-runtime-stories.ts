/* eslint-env browser */
import { logger } from 'storybook/internal/client-logger';

import type { StoryObj } from '@storybook/svelte';
import { mount, unmount, type Component } from 'svelte';

import type { Cmp, ComponentAnnotations, StoriesRepository } from '../types.ts';
import { getStoryChain } from '../utils/story-chain.ts';

import StoriesExtractor from '@storybook/svelte/internal/svelte-csf/StoriesExtractor.svelte';
import StoryRenderer from '@storybook/svelte/internal/svelte-csf/StoryRenderer.svelte';

const createFragment = document.createDocumentFragment
  ? () => document.createDocumentFragment()
  : () => document.createElement('div');

// Mounts the stories file once, with every `<Story>` collecting its props instead of rendering,
// then returns one CSF story per collected `<Story>`.
export const createRuntimeStories = (Stories: Component, meta: ComponentAnnotations<Cmp>) => {
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
    logger.error(`Error in mounting stories ${e.toString()}`, e);
  }

  const stories: Record<string, StoryObj<Cmp>> = {};
  const parents = new Map<string, string>();
  const exportNames = new Map<string | undefined, string>();

  for (const [exportName, { name }] of repository.stories) {
    exportNames.set(name, exportName);
  }
  for (const [exportName, { extend }] of repository.stories) {
    const parent = extend && exportNames.get(extend);
    if (parent) {
      parents.set(exportName, parent);
    }
  }

  for (const [exportName, story] of repository.stories) {
    // A story inherits the content, `asChild` and the play function of the nearest story it extends
    // that has them
    const chain = getStoryChain(parents, exportName).map(
      (name) => [name, repository.stories.get(name)!] as const
    );
    const [contentExportName] =
      chain.find(([, { children, template }]) => children || template) ?? chain[0];
    const [playExportName, playStory] = chain.find(([, { play }]) => play) ?? [];
    const [asChildExportName, asChildStory] =
      chain.find(([, story]) => story.asChild !== undefined) ?? [];
    // The props of the `<Story>` component that are not story annotations
    const { template: _template, asChild: _asChild, extend: _extend, ...annotations } = story;

    const storyObj: StoryObj<Cmp> = {
      ...annotations,
      render: (args, storyContext) => ({
        Component: StoryRenderer,
        props: {
          contentExportName,
          playExportName,
          asChildExportName,
          asChild: asChildStory?.asChild ?? false,
          Stories,
          storyContext,
          args,
          metaRenderSnippet: meta.render,
        },
      }),
    };

    const play = meta.play ?? playStory?.play;

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

  // Saving stories from the controls panel does not support `.stories.svelte` files.
  meta.parameters.controls.disableSaveFromUI = true;

  return stories;
};
