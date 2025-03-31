import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import { addons, useEffect, useState, useTransformCode } from 'storybook/preview-api';
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
  const [source, setSource] = useState<undefined | string>(undefined);

  const transformedCode = useTransformCode(source, context);

  useEffect(() => {
    if (toEmit) {
      const { id, unmappedArgs } = context;
      const format = parameters?.docs?.source?.format ?? true;
      channel.emit(SNIPPET_RENDERED, {
        id,
        args: unmappedArgs,
        source: transformedCode,
        format: format === true ? 'angular' : format,
      });
    }
  }, [channel, context, parameters?.docs?.source?.format, toEmit, transformedCode]);

  if (component && !userDefinedTemplate) {
    const sourceFromComponent = computesTemplateSourceFromComponent(component, props, argTypes);

    // We might have a story with a Directive or Service defined as the component
    // In these cases there might exist a template, even if we aren't able to create source from component
    const newSource = sourceFromComponent || template;

    if (newSource && newSource !== source) {
      setSource(newSource);
    }
  } else if (template && template !== source) {
    toEmit = template;
  }

  return story;
};
