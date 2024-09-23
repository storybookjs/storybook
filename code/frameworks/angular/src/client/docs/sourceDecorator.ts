import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import { addons, useEffect } from 'storybook/internal/preview-api';
import { ArgsStoryFn, PartialStoryFn } from 'storybook/internal/types';

import { computesTemplateSourceFromComponent } from '../../renderer';
import { AngularRenderer, StoryContext } from '../types';

export const skipSourceRender = (context: StoryContext) => {
  const sourceParams = context?.parameters.docs?.source;

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }
  // never render if the user is forcing the block to render code, or
  // if the user provides code
  return sourceParams?.code || sourceParams?.type === SourceType.CODE;
};

/**
 * Angular source decorator.
 *
 * @param storyFn Fn
 * @param context StoryContext
 */
export const sourceDecorator = (
  storyFn: PartialStoryFn<AngularRenderer>,
  context: StoryContext
) => {
  const story = storyFn();
  if (skipSourceRender(context)) {
    return story;
  }
  const channel = addons.getChannel();
  const { props, userDefinedTemplate } = story;
  const { component, argTypes, parameters } = context;
  const template: string = parameters.docs?.source?.excludeDecorators
    ? (context.originalStoryFn as ArgsStoryFn<AngularRenderer>)(context.args, context).template
    : story.template;

  let toEmit: string;

  useEffect(() => {
    if (toEmit) {
      const { id, unmappedArgs } = context;
      const format = parameters?.docs?.source?.format ?? true;
      channel.emit(SNIPPET_RENDERED, {
        id,
        args: unmappedArgs,
        source: toEmit,
        format: format === true ? 'angular' : format,
      });
    }
  });

  if (component && !userDefinedTemplate) {
    const source = computesTemplateSourceFromComponent(component, props, argTypes);

    // We might have a story with a Directive or Service defined as the component
    // In these cases there might exist a template, even if we aren't able to create source from component
    if (source || template) {
      toEmit = source || template;
    }
  } else if (template) {
    toEmit = template;
  }

  return story;
};
