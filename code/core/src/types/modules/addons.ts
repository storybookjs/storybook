/* eslint-disable @typescript-eslint/naming-convention */
import type { FC, PropsWithChildren, ReactElement, ReactNode } from 'react';

import type { RenderData as RouterData } from '../../router/types';
import type { ThemeVars } from '../../theming/types';
import type { API_SidebarOptions } from './api';
import type {
  Args,
  ArgsStoryFn as ArgsStoryFnForFramework,
  DecoratorFunction as DecoratorFunctionForFramework,
  InputType,
  LegacyStoryFn as LegacyStoryFnForFramework,
  LoaderFunction as LoaderFunctionForFramework,
  Parameters,
  PartialStoryFn as PartialStoryFnForFramework,
  Renderer,
  StoryContext as StoryContextForFramework,
  StoryFn as StoryFnForFramework,
  StoryId,
  StoryKind,
  StoryName,
} from './csf';
import type { IndexEntry } from './indexer';

export type Addon_Types = Exclude<
  Addon_TypesEnum,
  | Addon_TypesEnum.experimental_PAGE
  | Addon_TypesEnum.experimental_SIDEBAR_BOTTOM
  | Addon_TypesEnum.experimental_SIDEBAR_TOP
>;

export interface Addon_ArgType<TArg = unknown> extends InputType {
  defaultValue?: TArg;
}

export type Addons_ArgTypes<TArgs = Args> = {
  [key in keyof Partial<TArgs>]: Addon_ArgType<TArgs[key]>;
} & {
  // for custom defined args
  [key in string]: Addon_ArgType<unknown>;
};

export type Addon_Comparator<T> = ((a: T, b: T) => boolean) | ((a: T, b: T) => number);
export type Addon_StorySortMethod = 'configure' | 'alphabetical';
export interface Addon_StorySortObjectParameter {
  method?: Addon_StorySortMethod;
  order?: any[];
  locales?: string;
  includeNames?: boolean;
}

// The `any` here is the story store's `StoreItem` record. Ideally we should probably only
// pass a defined subset of that full data, but we pass it all so far :shrug:
export type IndexEntryLegacy = [StoryId, any, Parameters, Parameters];
export type Addon_StorySortComparator = Addon_Comparator<IndexEntryLegacy>;
export type Addon_StorySortParameter = Addon_StorySortComparator | Addon_StorySortObjectParameter;
export type Addon_StorySortComparatorV7 = Addon_Comparator<IndexEntry>;
export type Addon_StorySortParameterV7 =
  | Addon_StorySortComparatorV7
  | Addon_StorySortObjectParameter;

// TODO: remove all these types, they belong in the renderer and csf-package

export interface Addon_OptionsParameter extends Object {
  storySort?: Addon_StorySortParameter;
  theme?: {
    base: string;
    brandTitle?: string;
  };
  [key: string]: any;
}

export interface Addon_OptionsParameterV7 extends Object {
  storySort?: Addon_StorySortParameterV7;
  theme?: {
    base: string;
    brandTitle?: string;
  };
  [key: string]: any;
}

export type Addon_StoryContext<TRenderer extends Renderer = Renderer> =
  StoryContextForFramework<TRenderer>;
export type Addon_StoryContextUpdate = Partial<Addon_StoryContext>;

interface Addon_ReturnTypeFramework<ReturnType> extends Renderer {
  component: any;
  storyResult: ReturnType;
  canvasElement: any;
}
export type Addon_PartialStoryFn<ReturnType = unknown> = PartialStoryFnForFramework<
  Addon_ReturnTypeFramework<ReturnType>
>;
export type Addon_LegacyStoryFn<ReturnType = unknown> = LegacyStoryFnForFramework<
  Addon_ReturnTypeFramework<ReturnType>
>;
export type Addon_ArgsStoryFn<ReturnType = unknown> = ArgsStoryFnForFramework<
  Addon_ReturnTypeFramework<ReturnType>
>;
export type Addon_StoryFn<ReturnType = unknown> = StoryFnForFramework<
  Addon_ReturnTypeFramework<ReturnType>
>;

export type Addon_DecoratorFunction<StoryFnReturnType = unknown> = DecoratorFunctionForFramework<
  Addon_ReturnTypeFramework<StoryFnReturnType>
>;
export type Addon_LoaderFunction = LoaderFunctionForFramework<Addon_ReturnTypeFramework<unknown>>;

export interface Addon_WrapperSettings {
  options: object;
  parameters: {
    [key: string]: any;
  };
}

export type Addon_StoryWrapper = (
  storyFn: Addon_LegacyStoryFn,
  context: Addon_StoryContext,
  settings: Addon_WrapperSettings
) => any;

export type Addon_MakeDecoratorResult = (...args: any) => any;

export interface Addon_AddStoryArgs<StoryFnReturnType = unknown> {
  id: StoryId;
  kind: StoryKind;
  name: StoryName;
  storyFn: Addon_StoryFn<StoryFnReturnType>;
  parameters: Parameters;
}

export type Addon_ClientApiAddon<StoryFnReturnType = unknown> = Addon_Type & {
  apply: (a: Addon_StoryApi<StoryFnReturnType>, b: any[]) => any;
};

export interface Addon_ClientApiAddons<StoryFnReturnType> {
  [key: string]: Addon_ClientApiAddon<StoryFnReturnType>;
}

export type Addon_ClientApiReturnFn<StoryFnReturnType = unknown> = (
  ...args: any[]
) => Addon_StoryApi<StoryFnReturnType>;

export interface Addon_StoryApi<StoryFnReturnType = unknown> {
  kind: StoryKind;
  add: (
    storyName: StoryName,
    storyFn: Addon_StoryFn<StoryFnReturnType>,
    parameters?: Parameters
  ) => Addon_StoryApi<StoryFnReturnType>;
  addDecorator: (
    decorator: Addon_DecoratorFunction<StoryFnReturnType>
  ) => Addon_StoryApi<StoryFnReturnType>;
  addLoader: (decorator: Addon_LoaderFunction) => Addon_StoryApi<StoryFnReturnType>;
  addParameters: (parameters: Parameters) => Addon_StoryApi<StoryFnReturnType>;
  [k: string]: string | Addon_ClientApiReturnFn<StoryFnReturnType>;
}

export interface Addon_ClientStoryApi<StoryFnReturnType = unknown> {}

export type Addon_LoadFn = () => any;
export type Addon_RequireContext = any; // FIXME
export type Addon_Loadable = Addon_RequireContext | [Addon_RequireContext] | Addon_LoadFn;

// CSF types, to be re-org'ed in 6.1

export type Addon_BaseDecorators<StoryFnReturnType> = Array<
  (story: () => StoryFnReturnType, context: Addon_StoryContext) => StoryFnReturnType
>;

export interface Addon_BaseAnnotations<
  TArgs,
  StoryFnReturnType,
  TRenderer extends Renderer = Renderer,
> {
  /**
   * Dynamic data that are provided (and possibly updated by) Storybook and its addons.
   * @see [Arg story inputs](https://storybook.js.org/docs/react/api/csf#args-story-inputs)
   */
  args?: Partial<TArgs>;

  /**
   * ArgTypes encode basic metadata for args, such as `name`, `description`, `defaultValue` for an arg. These get automatically filled in by Storybook Docs.
   * @see [Arg types](https://storybook.js.org/docs/react/api/arg-types)
   */
  argTypes?: Addons_ArgTypes<TArgs>;

  /**
   * Custom metadata for a story.
   * @see [Parameters](https://storybook.js.org/docs/react/writing-stories/parameters)
   */
  parameters?: Parameters;

  /**
   * Wrapper components or Storybook decorators that wrap a story.
   *
   * Decorators defined in Meta will be applied to every story variation.
   * @see [Decorators](https://storybook.js.org/docs/addons/#1-decorators)
   */
  decorators?: Addon_BaseDecorators<StoryFnReturnType>;

  /**
   * Define a custom render function for the story(ies). If not passed, a default render function by the framework will be used.
   */
  render?: (args: TArgs, context: Addon_StoryContext<TRenderer>) => StoryFnReturnType;

  /**
   * Function that is executed after the story is rendered.
   */
  play?: (context: Addon_StoryContext<TRenderer>) => Promise<void> | void;
}

export interface Addon_Annotations<TArgs, StoryFnReturnType>
  extends Addon_BaseAnnotations<TArgs, StoryFnReturnType> {
  /**
   * Used to only include certain named exports as stories. Useful when you want to have non-story exports such as mock data or ignore a few stories.
   * @example
   * includeStories: ['SimpleStory', 'ComplexStory']
   * includeStories: /.*Story$/
   *
   * @see [Non-story exports](https://storybook.js.org/docs/formats/component-story-format/#non-story-exports)
   */
  includeStories?: string[] | RegExp;

  /**
   * Used to exclude certain named exports. Useful when you want to have non-story exports such as mock data or ignore a few stories.
   * @example
   * excludeStories: ['simpleData', 'complexData']
   * excludeStories: /.*Data$/
   *
   * @see [Non-story exports](https://storybook.js.org/docs/formats/component-story-format/#non-story-exports)
   */
  excludeStories?: string[] | RegExp;
}

export interface Addon_BaseMeta<ComponentType> {
  /**
   * Title of the story which will be presented in the navigation. **Should be unique.**
   *
   * Stories can be organized in a nested structure using "/" as a separator.
   *
   * Since CSF 3.0 this property is optional.
   *
   * @example
   * export default {
   *   ...
   *   title: 'Design System/Atoms/Button'
   * }
   *
   * @see [Story Hierarchy](https://storybook.js.org/docs/basics/writing-stories/#story-hierarchy)
   */
  title?: string;

  /**
   * Manually set the id of a story, which in particular is useful if you want to rename stories without breaking permalinks.
   *
   * Storybook will prioritize the id over the title for ID generation, if provided, and will prioritize the story.storyName over the export key for display.
   *
   * @see [Sidebar and URLs](https://storybook.js.org/docs/react/configure/sidebar-and-urls#permalinking-to-stories)
   */
  id?: string;

  /**
   * The primary component for your story.
   *
   * Used by addons for automatic prop table generation and display of other component metadata.
   */
  component?: ComponentType;

  /**
   * Auxiliary subcomponents that are part of the stories.
   *
   * Used by addons for automatic prop table generation and display of other component metadata.
   *
   * @example
   * import { Button, ButtonGroup } from './components';
   *
   * export default {
   *   ...
   *   subcomponents: { Button, ButtonGroup }
   * }
   *
   * By defining them each component will have its tab in the args table.
   *
   * @deprecated
   */
  subcomponents?: Record<string, ComponentType>;
}

export type Addon_BaseStoryObject<TArgs, StoryFnReturnType> = {
  /**
   * Override the display name in the UI
   */
  storyName?: string;
};

export type Addon_BaseStoryFn<TArgs, StoryFnReturnType> = {
  (args: TArgs, context: Addon_StoryContext): StoryFnReturnType;
} & Addon_BaseStoryObject<TArgs, StoryFnReturnType>;

export type BaseStory<TArgs, StoryFnReturnType> =
  | Addon_BaseStoryFn<TArgs, StoryFnReturnType>
  | Addon_BaseStoryObject<TArgs, StoryFnReturnType>;

export interface Addon_RenderOptions {
  active: boolean;
}

export type Addon_Type =
  | Addon_BaseType
  | Addon_PageType
  | Addon_WrapperType
  | Addon_SidebarBottomType
  | Addon_SidebarTopType;
export interface Addon_BaseType {
  /**
   * The title of the addon.
   * This can be a simple string, but it can also be a React.FunctionComponent or a React.ReactElement.
   */
  title: FC | ReactNode | (() => string);
  /**
   * The type of the addon.
   * @example Addon_TypesEnum.PANEL
   */
  type: Exclude<
    Addon_Types,
    | Addon_TypesEnum.PREVIEW
    | Addon_TypesEnum.experimental_PAGE
    | Addon_TypesEnum.experimental_SIDEBAR_BOTTOM
    | Addon_TypesEnum.experimental_SIDEBAR_TOP
  >;
  /**
   * The unique id of the addon.
   * @warn This will become non-optional in 8.0
   *
   * This needs to be globally unique, so we recommend prefixing it with your org name or npm package name.
   *
   * Do not prefix with `storybook`, this is reserved for core storybook feature and core addons.
   *
   * @example 'my-org-name/my-addon-name'
   */
  id?: string;
  /**
   * This component will wrap your `render` function.
   *
   * With it you can determine if you want your addon to be rendered or not.
   *
   * This is to facilitate addons keeping state, and keep listening for events even when they are not currently on screen/rendered.
   */
  route?: (routeOptions: RouterData) => string;
  /**
   * This will determine the value of `active` prop of your render function.
   */
  match?: (matchOptions: RouterData & { tabId?: string }) => boolean;
  /**
   * The actual contents of your addon.
   *
   * This is called as a function, so if you want to use hooks,
   * your function needs to return a JSX.Element within which components are rendered
   */
  render: (props: Partial<Addon_RenderOptions>) => ReturnType<FC<Partial<Addon_RenderOptions>>>;
  // TODO: for Storybook 9 I'd like to change this to be:
  // render: FC<Partial<Addon_RenderOptions>>;
  // This would bring it in line with how every other addon is set up.
  // We'd need to change how the render function is called in the manager:
  // https://github.com/storybookjs/storybook/blob/4e6fc0dde0842841d99cb3cf5148ca293a950301/code/ui/manager/src/components/preview/Preview.tsx#L105
  /**
   * @unstable
   */
  paramKey?: string;
  /**
   * @unstable
   */
  disabled?: boolean;
  /**
   * @unstable
   */
  hidden?: boolean;
}

export interface Addon_PageType {
  type: Addon_TypesEnum.experimental_PAGE;
  /**
   * The unique id of the page.
   */
  id: string;
  /**
   * The URL to navigate to when Storybook needs to navigate to this page.
   */
  url: string;
  /**
   * The title is used in mobile mode to represent the page in the navigation.
   */
  title: FC | string | ReactElement | ReactNode;
  /**
   * The main content of the addon, a function component without any props.
   * Storybook will render your component always.
   *
   * If you want to render your component only when the URL matches, use the `Route` component.
   * @example
   * import { Route } from '@storybook/core/router';
   *
   * render: () => {
   *   return (
   *     <Route path="/my-addon">
   *       <MyAddonContent />
   *     </Route>
   *   );
   * };
   */
  render: FC;
}

export interface Addon_WrapperType {
  type: Addon_TypesEnum.PREVIEW;
  /**
   * The unique id of the page.
   */
  id: string;
  /**
   * A React.FunctionComponent that wraps the story.
   *
   * This component must accept a children prop, and render it.
   */
  render: FC<
    PropsWithChildren<{
      index: number;
      children: ReactNode;
      id: string;
      storyId: StoryId;
    }>
  >;
}

/**
 * @deprecated This doesn't do anything anymore and will be removed in Storybook 9.0.
 */
export interface Addon_SidebarBottomType {
  type: Addon_TypesEnum.experimental_SIDEBAR_BOTTOM;
  /**
   * The unique id of the tool.
   */
  id: string;
  /**
   * A React.FunctionComponent.
   */
  render: FC;
}

/**
 * @deprecated This will be removed in Storybook 9.0.
 */
export interface Addon_SidebarTopType {
  type: Addon_TypesEnum.experimental_SIDEBAR_TOP;
  /**
   * The unique id of the tool.
   */
  id: string;
  /**
   * A React.FunctionComponent.
   */
  render: FC;
}

type Addon_TypeBaseNames = Exclude<
  Addon_TypesEnum,
  | Addon_TypesEnum.PREVIEW
  | Addon_TypesEnum.experimental_PAGE
  | Addon_TypesEnum.experimental_SIDEBAR_BOTTOM
  | Addon_TypesEnum.experimental_SIDEBAR_TOP
>;

export interface Addon_TypesMapping extends Record<Addon_TypeBaseNames, Addon_BaseType> {
  [Addon_TypesEnum.PREVIEW]: Addon_WrapperType;
  [Addon_TypesEnum.experimental_PAGE]: Addon_PageType;
  [Addon_TypesEnum.experimental_SIDEBAR_BOTTOM]: Addon_SidebarBottomType;
  [Addon_TypesEnum.experimental_SIDEBAR_TOP]: Addon_SidebarTopType;
}

export type Addon_Loader<API> = (api: API) => void;

export interface Addon_Loaders<API> {
  [key: string]: Addon_Loader<API>;
}
export interface Addon_Collection<T = Addon_Type> {
  [key: string]: T;
}
export interface Addon_Elements {
  [key: string]: Addon_Collection;
}
export interface Addon_ToolbarConfig {
  hidden?: boolean;
}
export interface Addon_Config {
  theme?: ThemeVars;
  toolbar?: {
    [id: string]: Addon_ToolbarConfig;
  };
  sidebar?: API_SidebarOptions;
  [key: string]: any;
}

export enum Addon_TypesEnum {
  /**
   * This API is used to create a tab the toolbar above the canvas, This API might be removed in the future.
   * @unstable
   */
  TAB = 'tab',
  /**
   * This adds panels to the addons side panel.
   */
  PANEL = 'panel',
  /**
   * This adds items in the toolbar above the canvas - on the left side.
   */
  TOOL = 'tool',
  /**
   * This adds items in the toolbar above the canvas - on the right side.
   */
  TOOLEXTRA = 'toolextra',
  /**
   * This adds wrapper components around the canvas/iframe component storybook renders.
   * @unstable this API is not stable yet, and is likely to change in 8.0.
   */
  PREVIEW = 'preview',
  /**
   * This adds pages that render instead of the canvas.
   * @unstable
   */
  experimental_PAGE = 'page',
  /**
   * This adds items in the bottom of the sidebar.
   * @deprecated This doesn't do anything anymore and will be removed in Storybook 9.0.
   */
  experimental_SIDEBAR_BOTTOM = 'sidebar-bottom',
  /**
   * This adds items in the top of the sidebar.
   * @deprecated This will be removed in Storybook 9.0.
   */
  experimental_SIDEBAR_TOP = 'sidebar-top',
}
