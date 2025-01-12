import type {
  DecoratorFunction,
  LegacyStoryFn,
  PartialStoryFn,
  Renderer,
  StoryContext,
  StoryContextUpdate,
} from '@storybook/core/types';

export function decorateStory<TRenderer extends Renderer>(
  storyFn: LegacyStoryFn<TRenderer>,
  decorator: DecoratorFunction<TRenderer>,
  bindWithContext: (storyFn: LegacyStoryFn<TRenderer>) => PartialStoryFn<TRenderer>
): LegacyStoryFn<TRenderer> {
  // Bind the partially decorated storyFn so that when it is called it always knows about the story context,
  // no matter what it is passed directly. This is because we cannot guarantee a decorator will
  // pass the context down to the next decorated story in the chain.
  const boundStoryFunction = bindWithContext(storyFn);

  return (context) => decorator(boundStoryFunction, context);
}

/**
 * Currently StoryContextUpdates are allowed to have any key in the type. However, you cannot
 * overwrite any of the build-it "static" keys.
 *
 * @param inputContextUpdate StoryContextUpdate
 * @returns StoryContextUpdate
 */
export function sanitizeStoryContextUpdate({
  componentId,
  title,
  kind,
  id,
  name,
  story,
  parameters,
  initialArgs,
  argTypes,
  ...update
}: StoryContextUpdate = {}): StoryContextUpdate {
  return update;
}

type ContextStore<TRenderer extends Renderer> = {
  value?: StoryContext<TRenderer>;
};

export function defaultDecorateStory<TRenderer extends Renderer>(
  storyFn: LegacyStoryFn<TRenderer>,
  decorators: DecoratorFunction<TRenderer>[]
): LegacyStoryFn<TRenderer> {
  // We use a trick to avoid recreating the bound story function inside `decorateStory`.
  // Instead we pass it a context "getter", which is defined once (at "decoration time")
  // The getter reads a variable which is scoped to this call of `decorateStory`
  // (ie to this story), so there is no possibility of overlap.
  // This will break if you call the same story twice interleaved
  // (React might do it if you rendered the same story twice in the one ReactDom.render call, for instance)
  const contextStore: ContextStore<TRenderer> = {};

  /**
   * When you call the story function inside a decorator, e.g.:
   *
   * ```jsx
   * <div>{storyFn({ foo: 'bar' })}</div>;
   * ```
   *
   * This will override the `foo` property on the `innerContext`, which gets merged in with the
   * default context
   */
  const bindWithContext =
    (decoratedStoryFn: LegacyStoryFn<TRenderer>): PartialStoryFn<TRenderer> =>
    (update) => {
      // This code path isn't possible because we always set `contextStore.value` before calling
      // `decoratedWithContextStore`, but TS doesn't know that.
      if (!contextStore.value) {
        throw new Error('Decorated function called without init');
      }
      contextStore.value = {
        ...contextStore.value,
        ...sanitizeStoryContextUpdate(update),
      };
      return decoratedStoryFn(contextStore.value);
    };

  const decoratedWithContextStore = decorators.reduce(
    (story, decorator) => decorateStory(story, decorator, bindWithContext),
    storyFn
  );
  return (context) => {
    contextStore.value = context;
    return decoratedWithContextStore(context); // Pass the context directly into the first decorator
  };
}
