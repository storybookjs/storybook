/* eslint-env browser */
import { logger } from '@storybook/client-logger';
import { combineParameters } from '@storybook/preview-api';
import type { Meta } from '@storybook/svelte';
import { mount, unmount } from 'svelte';

import type { StoriesDef, Story } from './types.js';
import { extractId } from './extract-id.js';

import RenderContext from '../components/RenderContext.svelte';
import RegisterContext from '../components/RegisterContext.svelte';

/* Called from a webpack loader and a jest transformation.
 *
 * It mounts a Stories component in a context which disables
 * the rendering of every <Story/> and <Template/> but instead
 * collects names and properties.
 *
 * For every discovered <Story/>, it creates a storyFn which
 * instantiate the main Stories component: Every Story but
 * the one selected is disabled.
 */

const createFragment = document.createDocumentFragment
  ? () => document.createDocumentFragment()
  : () => document.createElement('div');

export default <Component extends Parameters<typeof mount>[0]>(
  StoriesComponent: Component,
  { stories = {}, meta = {}, allocatedIds = [] }: StoriesDef
) => {
  const repositories = {
    meta: null as Meta<Component> | null,
    stories: [] as Story[],
  };

  // extract all stories
  try {
    const context = mount(RegisterContext, {
      target: createFragment() as Element,
      props: {
        Stories: StoriesComponent,
        repositories: () => repositories,
      },
    });
    unmount(context);
  } catch (e: any) {
    logger.error(`Error extracting stories ${e.toString()}`, e);
  }

  const { component: globalComponent } = meta;

  // collect templates id
  const templatesId = repositories.stories
    .filter((story) => story.isTemplate)
    .map((story) => story.id);

  // check for duplicate templates
  const duplicateTemplatesId = templatesId.filter(
    (item, index) => templatesId.indexOf(item) !== index
  );

  if (duplicateTemplatesId.length > 0) {
    logger.warn(
      `Found duplicates templates id for stories '${meta.component?.name}': ${duplicateTemplatesId}`
    );
  }

  return {
    meta,
    stories: repositories.stories
      .filter((story) => !story.isTemplate)
      .reduce((all, story) => {
        const { id, name, template, component, source = false, play, ...props } = story;

        const storyId = extractId(story, allocatedIds);
        if (!storyId) {
          return all;
        }

        const unknownTemplate = template != null && templatesId.indexOf(template) < 0;

        const storyFn = (args, storyContext) => {
          if (unknownTemplate) {
            throw new Error(`Story ${name} is referencing an unknown template ${template}`);
          }

          return {
            Component: RenderContext,
            props: {
              Stories: StoriesComponent,
              storyName: name,
              templateId: template,
              args,
              storyContext,
              sourceComponent: component || globalComponent,
            },
          };
        };

        storyFn.storyName = name;
        Object.entries(props).forEach(([k, v]) => {
          storyFn[k] = v;
        });

        // play ?
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

        // inject story sources
        const storyDef = stories[template ? `tpl:${template}` : storyId];

        const hasArgs = storyDef ? storyDef.hasArgs : true;

        // inject source snippet
        const rawSource = storyDef ? storyDef.source : null;
        if (rawSource) {
          storyFn.parameters = combineParameters(storyFn.parameters || {}, {
            storySource: {
              source: rawSource,
            },
          });
        }

        let snippet: string | null | undefined;

        if (source === true || (source === false && !hasArgs)) {
          snippet = rawSource;
        } else if (typeof source === 'string') {
          snippet = source;
        }

        if (snippet) {
          storyFn.parameters = combineParameters(storyFn.parameters || {}, {
            docs: { source: { code: snippet } },
          });
        }

        const relStory = stories[storyId];
        if (relStory?.description) {
          storyFn.parameters = combineParameters(storyFn.parameters || {}, {
            docs: {
              description: {
                story: relStory.description,
              },
            },
          });
        }

        // eslint-disable-next-line no-param-reassign
        all[storyId] = storyFn;
        return all;
      }, {}) as { [key: string]: { storyName: string; parameters: string } },
  };
};
