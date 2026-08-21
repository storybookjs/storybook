import {
  type Canvas,
  type StoryContext as StoryContextBase,
  type WebRenderer,
} from 'storybook/internal/types';

import type { App, ConcreteComponent } from 'vue';
import type { ComponentMeta } from 'vue-component-meta';
import type { ComponentDoc } from 'vue-docgen-api';

export type { RenderContext } from 'storybook/internal/types';

export type StoryID = string;

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export type StoryFnVueReturnType = ConcreteComponent<any>;

export type StoryContext = StoryContextBase<VueRenderer>;

export type StorybookVueApp = { vueApp: App<any>; storyContext: StoryContext };

export interface VueRenderer extends WebRenderer {
  // We are omitting props, as we don't use it internally, and more importantly, it completely changes the assignability of meta.component.
  // Try not omitting, and check the type errros in the test file, if you want to learn more.
  component: Omit<ConcreteComponent<this['T']>, 'props'>;
  storyResult: StoryFnVueReturnType;

  mount: (
    Component?: StoryFnVueReturnType,
    // TODO add proper typesafety
    options?: { props?: Record<string, any>; slots?: Record<string, any> }
  ) => Promise<Canvas>;
}

export interface VueTypes extends VueRenderer {}

export type VueDocgenPlugin = 'vue-docgen-api' | 'vue-component-meta';

type ArrayElement<T> = T extends readonly (infer A)[] ? A : never;

export type VueDocgenInfo<T extends VueDocgenPlugin> = T extends 'vue-component-meta'
  ? ComponentMeta
  : ComponentDoc;

/**
 * Single prop/event/slot/exposed entry of "__docgenInfo" depending on the used docgenPlugin.
 *
 * @example
 *
 * ```ts
 * type PropInfo = VueDocgenInfoEntry<'vue-component-meta', 'props'>;
 * ```
 */
export type VueDocgenInfoEntry<
  T extends VueDocgenPlugin,
  TKey extends 'props' | 'events' | 'slots' | 'exposed' | 'expose' =
    | 'props'
    | 'events'
    | 'slots'
    | 'exposed'
    | 'expose',
> = ArrayElement<
  T extends 'vue-component-meta'
    ? VueDocgenInfo<'vue-component-meta'>[Exclude<TKey, 'expose'>]
    : VueDocgenInfo<'vue-docgen-api'>[Exclude<TKey, 'exposed'>]
>;
