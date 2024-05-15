/* eslint-env browser */
import { logger } from '@storybook/client-logger';
import { combineArgs, combineParameters } from '@storybook/preview-api';
import type { Meta, StoryFn } from '@storybook/svelte';
import { type ComponentProps, type SvelteComponent, mount, unmount } from 'svelte';

import type { StoriesFileMeta } from './types.js';
import type { StoriesRepository } from '../components/context.svelte.js';

import StoriesExtractor from '../components/StoriesExtractor.svelte';
import StoryRenderer from '../components/StoryRenderer.svelte';
import { combineTags } from '@storybook/csf';

const createFragment = document.createDocumentFragment
  ? () => document.createDocumentFragment()
  : () => document.createElement('div');

/**
 * @module
 * Called from a webpack loader and a jest transformation.
 *
 * It mounts a Stories component in a context which disables
 * the rendering of every <Story/> and <Template/> but instead
 * collects names and properties.
 *
 * For every discovered <Story/>, it creates a storyFn which
 * instantiate the main Stories component: Every Story but
 * the one selected is disabled.
 */
export default <Component extends SvelteComponent>(
  Stories: Component,
  storiesFileMeta: StoriesFileMeta,
  meta: Meta<Component>
) => {
  if (!meta.parameters?.docs?.description?.component) {
    meta.parameters = combineParameters(meta.parameters, {
      docs: {
        description: {
          component: storiesFileMeta.module.description,
        },
      },
    });
  }

  const repository: StoriesRepository<Component> = {
    meta,
    templates: new Map(),
    stories: new Map(),
  };

  try {
    const context = mount(StoriesExtractor, {
      target: createFragment() as Element,
      props: {
        Stories,
        repository: () => repository,
      } satisfies ComponentProps<StoriesExtractor>,
    });

    unmount(context);
  } catch (e: any) {
    logger.error(`Error in mounting stories ${e.toString()}`, e);
  }

  const stories: Record<string, StoryFn<Component>> = {};

  for (const [name, story] of repository.stories) {
    const { templateId } = story;
    const template = templateId && repository.templates.get(templateId);
    const templateMeta = templateId && storiesFileMeta.fragment.templates[templateId];
    const storyMeta = storiesFileMeta.fragment.stories[name];

    // FIXME: What exactly is missing?
    // NOTE: We can't use StoryObj, because `@storybook/svelte` accepts `StoryFn` for now
    const storyFn: StoryFn<Component> = (args, storyContext) => {
      return {
        Component: StoryRenderer,
        props: {
          ...meta,
          storyName: story.name,
          templateId,
          Stories,
          storyContext,
          args,
        } satisfies ComponentProps<StoryRenderer>,
      };
    };
    storyFn.storyName = story.name;
    storyFn.args = combineArgs(meta.args, { ...template?.args, ...story.args });
    storyFn.parameters = combineParameters(
      meta.parameters,
      template?.parameters,
      story.parameters,
      templateMeta?.description || storyMeta.description
        ? {
            docs: {
              description: {
                story: storyMeta.description ?? templateMeta?.description,
              },
            },
          }
        : undefined,
      templateMeta?.rawSource || storyMeta.rawSource
        ? {
            docs: {
              source: {
                code: storyMeta.rawSource ?? templateMeta?.rawSource,
              },
            },
            storySource: {
              source: storyMeta.rawSource ?? templateMeta?.rawSource,
            },
          }
        : undefined
    );
    storyFn.tags = combineTags(
      ...(meta.tags ?? []),
      ...(template?.tags ?? []),
      ...(story.tags ?? [])
    );

    const play = meta.play ?? template?.play ?? story.play;

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
