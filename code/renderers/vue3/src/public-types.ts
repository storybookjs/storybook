import type {
  AnnotatedStoryFn,
  Args,
  ArgsFromMeta,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  StoryContext as GenericStoryContext,
  LoaderFunction,
  ProjectAnnotations,
  StoryAnnotations,
  StrictArgs,
} from 'storybook/internal/types';

import type { Constructor, RemoveIndexSignature, SetOptional, Simplify } from 'type-fest';
import type { FunctionalComponent, VNodeChild } from 'vue';
import type { ComponentProps, ComponentSlots } from 'vue-component-type-helpers';

import type { VueRenderer } from './types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { VueRenderer };

/**
 * Helper type to extend component props with custom args that don't map directly to component props.
 *
 * This is useful when you want to use args to control aspects of rendering beyond the component's props,
 * such as adding wrapper elements, conditional rendering, theming, or any custom logic in your render function.
 *
 * @example
 * ```typescript
 * import type { Meta, StoryObj, WithCustomArgs } from '@storybook/vue3';
 * import MyPage from './Page.vue';
 *
 * // Define custom args that extend the component's props
 * type PageArgs = WithCustomArgs<typeof MyPage, {
 *   footer?: string;
 *   theme?: 'light' | 'dark';
 * }>;
 *
 * const meta = {
 *   component: MyPage,
 *   render: ({ footer, theme, ...pageProps }) => ({
 *     components: { MyPage },
 *     template: `
 *       <div :class="theme">
 *         <MyPage v-bind="pageProps" />
 *         <footer v-if="footer">{{ footer }}</footer>
 *       </div>
 *     `,
 *     setup() {
 *       return { footer, theme, pageProps };
 *     }
 *   })
 * } satisfies Meta<PageArgs>;
 *
 * export default meta;
 * type Story = StoryObj<typeof meta>;
 *
 * export const WithFooter: Story = {
 *   args: {
 *     footer: 'Built with Storybook',
 *     theme: 'light'
 *   }
 * };
 * ```
 *
 * @see https://storybook.js.org/docs/writing-stories/args#args-can-modify-any-aspect-of-your-component
 */
export type WithCustomArgs<
  TComponent,
  TCustomArgs extends Record<string, any> = Record<string, never>
> = ComponentPropsAndSlots<TComponent> & TCustomArgs;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/api/csf#default-export)
 */
export type Meta<TCmpOrArgs = Args> = ComponentAnnotations<
  VueRenderer,
  ComponentPropsOrProps<TCmpOrArgs>
>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryFn<TCmpOrArgs = Args> = AnnotatedStoryFn<
  VueRenderer,
  ComponentPropsOrProps<TCmpOrArgs>
>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryObj<TMetaOrCmpOrArgs = Args> = TMetaOrCmpOrArgs extends {
  render?: ArgsStoryFn<VueRenderer, any>;
  component?: infer Component;
  args?: infer DefaultArgs;
}
  ? Simplify<
      ComponentPropsAndSlots<Component> & ArgsFromMeta<VueRenderer, TMetaOrCmpOrArgs>
    > extends infer TArgs
    ? StoryAnnotations<
        VueRenderer,
        TArgs,
        SetOptional<TArgs, Extract<keyof TArgs, keyof DefaultArgs>>
      >
    : never
  : StoryAnnotations<VueRenderer, ComponentPropsOrProps<TMetaOrCmpOrArgs>>;

type ExtractSlots<C> = AllowNonFunctionSlots<Partial<RemoveIndexSignature<ComponentSlots<C>>>>;

type AllowNonFunctionSlots<Slots> = {
  [K in keyof Slots]: Slots[K] | VNodeChild;
};

export type ComponentPropsAndSlots<C> = ComponentProps<C> & ExtractSlots<C>;

type ComponentPropsOrProps<TCmpOrArgs> =
  TCmpOrArgs extends Constructor<any>
    ? ComponentPropsAndSlots<TCmpOrArgs>
    : TCmpOrArgs extends FunctionalComponent<any>
      ? ComponentPropsAndSlots<TCmpOrArgs>
      : TCmpOrArgs;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<VueRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<VueRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<VueRenderer, TArgs>;
export type Preview = ProjectAnnotations<VueRenderer>;
