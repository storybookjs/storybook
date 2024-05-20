/* eslint-env browser */
import { combineTags } from '@storybook/csf';
import { logger } from '@storybook/client-logger';
import { combineArgs, combineParameters } from '@storybook/preview-api';
import type { Meta, StoryFn } from '@storybook/svelte';
import { type SvelteComponent, mount, unmount } from 'svelte';

import type { StoriesFileMeta } from './types.js';
import type { StoriesRepository } from '../components/context.svelte.js';

import StoriesExtractor from '../components/StoriesExtractor.svelte';
import StoryRenderer from '../components/StoryRenderer.svelte';

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
export default <M extends Meta>(
  Stories: SvelteComponent,
  storiesFileMeta: StoriesFileMeta,
  meta: M
) => {
  if (!meta.parameters?.docs?.description?.component && storiesFileMeta.module.description) {
    meta.parameters = combineParameters(meta.parameters, {
      docs: {
        description: {
          component: storiesFileMeta.module.description,
        },
      },
    });
  }

  const repository: StoriesRepository<M> = {
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

  const stories: Record<string, StoryFn<StoryRenderer>> = {};

  for (const [name, story] of repository.stories) {
    const storyMeta = storiesFileMeta.fragment.stories[name];

    // NOTE: We can't use StoryObj, because `@storybook/svelte` accepts `StoryFn` for now
    const storyFn: StoryFn<StoryRenderer> = (args, storyContext) => {
      return {
        Component: StoryRenderer,
        props: {
          storyName: story.name,
          Stories,
          storyContext,
          args,
        },
      };
    };
    storyFn.storyName = story.name;
    storyFn.args = combineArgs(meta.args, story.args);
    storyFn.parameters = combineParameters(
      meta.parameters,
      story.parameters,
      storyMeta.description
        ? {
            docs: {
              description: {
                story: storyMeta.description,
              },
            },
          }
        : undefined
      // TODO: Wait for the response on this case
      // storyMeta.rawSource
      // 	? {
      // 			docs: {
      // 				source: {
      // 					code: storyMeta.rawSource,
      // 				},
      // 			},
      // 			storySource: {
      // 				source: storyMeta.rawSource,
      // 			},
      // 		}
      // 	: undefined,
    );
    storyFn.tags = combineTags(...(meta.tags ?? []), ...(story.tags ?? []));

    const play = meta.play ?? story.play;

    if (play) {
      /*
       * The 'play' function should be delegated to the real play Story function
       * in order to be run into the component scope.
       */
      storyFn.play = (storyContext) => {
        const delegate = storyContext.playFunction?.__play;

        if (delegate) {
          return delegate(storyContext);
        }

        return play(storyContext);
      };
    }

    stories[name] = storyFn;
  }

  return { meta, stories };
};
