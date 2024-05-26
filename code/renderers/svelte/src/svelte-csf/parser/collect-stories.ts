/* eslint-env browser */
import { combineTags } from '@storybook/csf';
import { logger } from '@storybook/client-logger';
import { combineArgs, combineParameters } from '@storybook/preview-api';
import type { Meta, StoryFn } from '@storybook/svelte';
import { mount, unmount, type ComponentType } from 'svelte';

import type { StoriesFileMeta } from './types.js';

import type { StoriesRepository } from '../components/contexts.svelte.js';
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
export default <TMeta extends Meta>(
  Stories: ComponentType,
  storiesFileMeta: StoriesFileMeta,
  meta: TMeta
) => {
  if (!meta.parameters?.docs?.description?.component && storiesFileMeta.defineMeta.description) {
    meta.parameters = combineParameters(meta.parameters, {
      docs: {
        description: {
          component: storiesFileMeta.defineMeta.description,
        },
      },
    });
  }

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

  const stories: Record<string, StoryFn<StoryRenderer<TMeta>>> = {};

  for (const [name, story] of repository.stories) {
    const storyMeta = storiesFileMeta.stories[name];

    // NOTE: We can't use StoryObj, because `@storybook/svelte` accepts `StoryFn` for now
    const storyFn: StoryFn<StoryRenderer<TMeta>> = (args, storyContext) => {
      return {
        Component: StoryRenderer<TMeta>,
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
    storyFn.parameters = combineParameters({}, meta.parameters, story.parameters);
    storyFn.tags = combineTags(...(meta.tags ?? []), ...(story.tags ?? []));

    if (storyMeta.description) {
      storyFn.parameters = combineParameters(storyFn.parameters, {
        docs: {
          description: {
            story: storyMeta.description,
          },
        },
      });
    }

    if (storyMeta.rawSource) {
      storyFn.parameters = combineParameters(storyFn.parameters, {
        storySource: {
          source: storyMeta.rawSource,
        },
      });
    }

    if (storyMeta.source) {
      let code: string | undefined;

      if (storyMeta.source === true && storyMeta.rawSource) {
        code = storyMeta.rawSource;
      }

      if (typeof storyMeta.source === 'string') {
        code = storyMeta.source;
      }

      if (code) {
        storyFn.parameters = combineParameters(storyFn.parameters, {
          docs: {
            source: { code },
          },
        });
      }
    }

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
