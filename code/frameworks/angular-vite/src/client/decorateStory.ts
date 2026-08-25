import { sanitizeStoryContextUpdate } from 'storybook/preview-api';
import type { DecoratorFunction, LegacyStoryFn, StoryContext } from 'storybook/internal/types';

import { computesTemplateFromComponent } from './renderer/ComputesTemplateFromComponent.ts';
import type { AngularRenderer } from './types.ts';

export default function decorateStory(
  mainStoryFn: LegacyStoryFn<AngularRenderer>,
  decorators: DecoratorFunction<AngularRenderer>[]
): LegacyStoryFn<AngularRenderer> {
  const returnDecorators = decorators.reduce(
    (previousStoryFn: LegacyStoryFn<AngularRenderer>, decorator) =>
      (context: StoryContext<AngularRenderer>) => {
        const decoratedStory = decorator((update) => {
          return previousStoryFn({
            ...context,
            ...sanitizeStoryContextUpdate(update),
          });
        }, context);

        return decoratedStory;
      },
    (context) => prepareMain(mainStoryFn(context), context)
  );

  return returnDecorators;
}

export { decorateStory };

const prepareMain = (
  story: AngularRenderer['storyResult'],
  context: StoryContext<AngularRenderer>
): AngularRenderer['storyResult'] => {
  let { template } = story;

  const { component } = context;
  const userDefinedTemplate = !hasNoTemplate(template);

  if (!userDefinedTemplate && component) {
    template = computesTemplateFromComponent(component, story.props, '');
  }
  return {
    ...story,
    ...(template ? { template, userDefinedTemplate } : {}),
  };
};

function hasNoTemplate(template: string | null | undefined): template is undefined {
  return template === null || template === undefined;
}
