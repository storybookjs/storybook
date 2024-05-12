/* eslint-env browser */
import { logger } from '@storybook/client-logger';
import { combineParameters } from '@storybook/preview-api';
import type { Meta, StoryFn } from '@storybook/svelte';
import { deepmerge } from 'deepmerge-ts';
import { type ComponentProps, type SvelteComponent, mount, unmount } from 'svelte';

import type { StoriesFileMeta } from './types.js';
import type { Repositories } from '../components/context.js';

import RenderContext from '../components/RenderContext.svelte';
import RegisterContext from '../components/RegisterContext.svelte';

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
          component: storiesFileMeta.description,
        },
      },
    });
  }

  const repositories: Repositories<Component> = {
    meta,
    templates: new Map(),
    stories: new Map(),
  };

  // extract all stories
  try {
    const context = mount(RegisterContext, {
      target: createFragment() as Element,
      props: {
        Stories,
        repositories: () => repositories,
      } satisfies ComponentProps<RegisterContext>,
    });

    unmount(context);
  } catch (e: any) {
    logger.error(`Error in mounting stories ${e.toString()}`, e);
  }

  const stories: Record<string, StoryFn<Component>> = {};

  for (const [name, story] of repositories.stories) {
    const { templateId } = story;
    const template = templateId && repositories.templates.get(templateId);
    const templateMeta = templateId && storiesFileMeta.templates[templateId];
    const storyMeta = storiesFileMeta.stories[name];

    // NOTE: It cannot be moved to `StoryObj`, because of `@storybook/svelte` and `PreviewRenderer` - it accepts fn's
    const storyFn: StoryFn = (args, storyContext) => {
      const props: ComponentProps<RenderContext> = {
        // FIXME: Is this the right direction?
        ...deepmerge(meta, template, story),
        Stories,
        name,
        args,
        sourceComponent: meta.component,
        storyContext,
        templateId,
      };

      return {
        Component: RenderContext,
        props,
      };
    };
    storyFn.storyName = name;
    storyFn.args = deepmerge({}, meta.args, template?.args, story.args);
    storyFn.parameters = deepmerge(template?.parameters, story.parameters, {
      docs: {
        description: {
          story: storyMeta.description,
        },
        source: {
          code: storyMeta.rawSource ?? templateMeta?.rawSource,
        },
      },
      storySource: {
        source: storyMeta.rawSource ?? templateMeta?.rawSource,
      },
    });

    const play = deepmerge(meta.play, template?.play, story.play);

    if (play) {
      /*
       * The 'play' function should be delegated to the real play Story function
       * in order to be run into the component scope.
       */
      storyFn.play = (storyContext) => {
        const delegate = storyContext?.playFunction?.__play;
        if (delegate) {
          return delegate(storyContext);
        }

        return play(storyContext);
      };
    }

    Object.assign(stories, { [name]: storyFn });
  }

  console.log('PARSER', { storiesFileMeta, repositories, meta, stories });

  return { meta, stories };
};
