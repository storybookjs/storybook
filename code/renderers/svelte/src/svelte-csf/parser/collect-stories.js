/* eslint-env browser */
import { logger } from '@storybook/client-logger';
import { combineParameters } from '@storybook/client-api';
import { extractId } from './extract-id';

import RegisterContext from '../components/RegisterContext.svelte';
import RenderContext from '../components/RenderContext.svelte';

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

export default (StoriesComponent, stories) => {
  const repositories = {
    meta: null,
    stories: [],
  };

  // extract all stories
  try {
    const context = new RegisterContext({
      target: createFragment(),
      props: {
        Stories: StoriesComponent,
        repositories,
      },
    });
    context.$destroy();
  } catch (e) {
    logger.error(`Error extracting stories ${e.toString()}`, e);
  }

  const { meta } = repositories;
  if (!meta) {
    logger.error('Missing <Meta/> tag');
    return {};
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
      `Found duplicates templates id for stories '${meta.name}': ${duplicateTemplatesId}`
    );
  }

  return {
    meta,
    stories: repositories.stories
      .filter((story) => !story.isTemplate)
      .reduce((all, story) => {
        const { id, name, template, component, source = false, ...props } = story;

        const storyId = extractId(story);
        if (!storyId) {
          return all;
        }

        const unknownTemplate = template != null && templatesId.indexOf(template) < 0;

        const storyFn = (args) => {
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
              sourceComponent: component || globalComponent,
            },
          };
        };

        storyFn.storyName = name;
        Object.entries(props).forEach(([k, v]) => {
          storyFn[k] = v;
        });

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

        let snippet;

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

        // eslint-disable-next-line no-param-reassign
        all[storyId] = storyFn;
        return all;
      }, {}),
  };
};
