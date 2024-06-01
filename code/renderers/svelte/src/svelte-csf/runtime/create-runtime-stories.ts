/* eslint-env browser */
import { logger } from '@storybook/client-logger';
import type { Meta, StoryObj } from '@storybook/svelte';
import { mount, unmount, type ComponentType } from 'svelte';

import StoriesExtractor from './StoriesExtractor.svelte';
import StoryRenderer from './StoryRenderer.svelte';
import type { StoriesRepository } from './contexts/extractor.svelte.js';

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
// TODO: I'm not sure the 'meta' is necessary here. As long as it's default exported, SB should internally combine it with the stories. Except for the play logic below, that looks funky, need to ask Pablo about that.
export const createRuntimeStories = <TMeta extends Meta>(Stories: ComponentType, meta: TMeta) => {
  const repository: StoriesRepository<TMeta> = {
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

  const stories: Record<string, StoryObj<StoryRenderer<TMeta>>> = {};

  for (const [exportName, story] of repository.stories) {
    const storyObj: StoryObj<StoryRenderer<TMeta>> = {
      ...story,
      render: (args, storyContext) => ({
        Component: StoryRenderer<TMeta>,
        props: {
          exportName,
          Stories,
          storyContext,
          args,
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

        return play(storyContext);
      };
    }

    stories[exportName] = storyObj;
  }

  return stories;
};
