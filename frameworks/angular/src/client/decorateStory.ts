import { sanitizeStoryContextUpdate } from 'storybook/internal/preview-api';
import { DecoratorFunction, LegacyStoryFn, StoryContext } from 'storybook/internal/types';

import { computesTemplateFromComponent } from './angular-beta/ComputesTemplateFromComponent';
import { AngularRenderer } from './types';

export default function decorateStory(
  mainStoryFn: LegacyStoryFn<AngularRenderer>,
  decorators: DecoratorFunction<AngularRenderer>[]
): LegacyStoryFn<AngularRenderer> {
  const returnDecorators = [cleanArgsDecorator, ...decorators].reduce(
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

const cleanArgsDecorator: DecoratorFunction<AngularRenderer> = (storyFn, context) => {
  if (!context.argTypes || !context.args) {
    return storyFn();
  }

  const argsToClean = context.args;

  context.args = Object.entries(argsToClean).reduce((obj, [key, arg]) => {
    const argType = context.argTypes[key];

    // Only keeps args with a control or an action in argTypes
    if (argType?.action || argType?.control) {
      return { ...obj, [key]: arg };
    }
    return obj;
  }, {});

  return storyFn();
};
