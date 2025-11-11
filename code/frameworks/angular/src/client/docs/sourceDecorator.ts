import { SourceType } from 'storybook/internal/docs-tools';
import { useRef, emitTransformCode, useEffect } from 'storybook/preview-api';
import type { ArgsStoryFn, PartialStoryFn } from 'storybook/internal/types';

import { computesTemplateSourceFromComponent } from '../../renderer';
import type { AngularRenderer, StoryContext } from '../types';

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
  const source = useRef<undefined | string>(undefined);

  useEffect(() => {
    if (skipSourceRender(context)) {
      return;
    }

    const { props, userDefinedTemplate } = story;
    const { component, parameters } = context;
    const template: string = parameters.docs?.source?.excludeDecorators
      ? (context.originalStoryFn as ArgsStoryFn<AngularRenderer>)(context.args, context).template
      : story.template;

    if (component && !userDefinedTemplate) {
      const sourceFromComponent = computesTemplateSourceFromComponent(component, props);

      // We might have a story with a Directive or Service defined as the component
      // In these cases there might exist a template, even if we aren't able to create source from component
      const newSource = sourceFromComponent || template;

      if (newSource && newSource !== source.current) {
        emitTransformCode(newSource, context);
        source.current = newSource;
      }
    } else if (template && template !== source.current) {
      emitTransformCode(template, context);
      source.current = template;
    }
  });

  return story;
};
