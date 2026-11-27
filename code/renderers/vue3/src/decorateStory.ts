import type { DecoratorFunction, LegacyStoryFn, StoryContext } from 'storybook/internal/types';

import { sanitizeStoryContextUpdate } from 'storybook/preview-api';
import type { Component, ComponentOptions, ConcreteComponent } from 'vue';
import { h } from 'vue';

import type { VueRenderer } from './types.ts';

/*
  This normalizes a functional component into a render method in ComponentOptions.

  The concept is taken from Vue 3's `defineComponent` but changed from creating a `setup`
  method on the ComponentOptions so end-users don't need to specify a "thunk" as a decorator.
 */

function normalizeFunctionalComponent(options: ConcreteComponent): ComponentOptions {
  return typeof options === 'function' ? { render: options, name: options.name } : options;
}

function prepare(
  rawStory: VueRenderer['storyResult'],
  innerStory?: ConcreteComponent
): Component | null {
  const story = rawStory as ComponentOptions;
  if (story === null) {
    return null;
  }

  if (typeof story === 'function') {
    return story;
  } // we don't need to wrap a functional component nor to convert it to a component options // we don't need to wrap a functional component nor to convert it to a component options
  if (innerStory) {
    return {
      // Normalize so we can always spread an object
      ...normalizeFunctionalComponent(story),
      components: { ...(story.components || {}), story: innerStory },
    };
  }

  return {
    render() {
      return h(story);
    },
  };
}

/*
  The `story` component a decorator template renders. It must be a stateful component, not a
  functional one: `<KeepAlive>` only caches stateful components, so with a functional wrapper the
  decorated story was never kept alive and its `onActivated`/`onDeactivated` hooks never ran.

  `inheritAttrs: false` and the filter keep the attribute fallthrough the functional wrapper had:
  only `class`, `style` and `on*` listeners reach the story.

  `getStory` is read on every render, so a decorator that calls `storyFn` again (for example in
  `setup()` with new args) renders the story that call returned.
 */
function wrapInnerStory(getStory: () => VueRenderer['storyResult']): ConcreteComponent {
  return {
    name: 'Story',
    inheritAttrs: false,
    render() {
      const fallthrough = Object.fromEntries(
        Object.entries(this.$attrs).filter(
          ([key]) => key === 'class' || key === 'style' || /^on[^a-z]/.test(key)
        )
      );
      return h(getStory(), fallthrough);
    },
  };
}

export function decorateStory(
  storyFn: LegacyStoryFn<VueRenderer>,
  decorators: DecoratorFunction<VueRenderer>[]
): LegacyStoryFn<VueRenderer> {
  return decorators.reduce(
    (decorated: LegacyStoryFn<VueRenderer>, decorator) => (context: StoryContext<VueRenderer>) => {
      let story: VueRenderer['storyResult'] | undefined;

      const decoratedStory: VueRenderer['storyResult'] = decorator((update) => {
        const sanitizedUpdate = sanitizeStoryContextUpdate(update);
        if (update) {
          sanitizedUpdate.args = Object.assign(context.args, sanitizedUpdate.args);
        }
        story = decorated({ ...context, ...sanitizedUpdate });
        return story;
      }, context);

      if (!story) {
        story = decorated(context);
      }

      if (decoratedStory === story) {
        return story;
      }

      return prepare(
        decoratedStory,
        wrapInnerStory(() => story!)
      ) as VueRenderer['storyResult'];
    },
    (context) => prepare(storyFn(context)) as LegacyStoryFn<VueRenderer>
  );
}
