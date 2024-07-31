import type {
  Addon_LegacyStoryFn,
  Addon_StoryContext,
  Addon_StoryWrapper,
} from '@storybook/core/types';

export type MakeDecoratorResult = (...args: any) => any;

export interface MakeDecoratorOptions {
  name: string;
  parameterName: string;
  skipIfNoParametersOrOptions?: boolean;
  wrapper: Addon_StoryWrapper;
}

/**
 * Creates a Storybook decorator function that can be used to wrap stories with additional functionality.
 *
 * @param {MakeDecoratorOptions} options - The options for the decorator.
 * @param {string} options.name - The name of the decorator.
 * @param {string} options.parameterName - The name of the parameter that will be used to pass options to the decorator.
 * @param {Addon_StoryWrapper} options.wrapper - The function that will be used to wrap the story.
 * @param {boolean} [options.skipIfNoParametersOrOptions=false] - Whether to skip the decorator if no options or parameters are provided.
 * @returns {MakeDecoratorResult} A function that can be used as a Storybook decorator.
 *
 * @example
 * const myDecorator = makeDecorator({
 *   name: 'My Decorator',
 *   parameterName: 'myDecorator',
 *   wrapper: (storyFn, context, { options }) => {
 *     const { myOption } = options;
 *     return <div style={{ backgroundColor: myOption }}>{storyFn()}</div>;
 *   },
 * });
 *
 * export const decorators = [myDecorator];
 */
export const makeDecorator = ({
  name,
  parameterName,
  wrapper,
  skipIfNoParametersOrOptions = false,
}: MakeDecoratorOptions): MakeDecoratorResult => {
  const decorator: any =
    (options: object) => (storyFn: Addon_LegacyStoryFn, context: Addon_StoryContext) => {
      const parameters = context.parameters && context.parameters[parameterName];

      if (parameters && parameters.disable) {
        return storyFn(context);
      }

      if (skipIfNoParametersOrOptions && !options && !parameters) {
        return storyFn(context);
      }

      return wrapper(storyFn, context, {
        options,
        parameters,
      });
    };

  return (...args: any) => {
    // Used without options as .addDecorator(decorator)
    if (typeof args[0] === 'function') {
      return decorator()(...args);
    }

    return (...innerArgs: any): any => {
      // Used as [.]addDecorator(decorator(options))
      if (innerArgs.length > 1) {
        // Used as [.]addDecorator(decorator(option1, option2))
        if (args.length > 1) {
          return decorator(args)(...innerArgs);
        }
        return decorator(...args)(...innerArgs);
      }

      throw new Error(
        `Passing stories directly into ${name}() is not allowed,
        instead use addDecorator(${name}) and pass options with the '${parameterName}' parameter`
      );
    };
  };
};
