import type { ViewMode as ViewModeBase } from '@storybook/core/csf';
import type { Renderer as CSFRenderer } from '@storybook/core/csf';

import type { Addon_OptionsParameter } from './addons';

// Fix https://github.com/storybookjs/storybook/issues/30540
// Can be removed once @storybook/core and storybook are merged in 9.0
export interface Renderer extends CSFRenderer {}

export type {
  AfterEach,
  AnnotatedStoryFn,
  Args,
  ArgsEnhancer,
  ArgsFromMeta,
  ArgsStoryFn,
  ArgTypes,
  ArgTypesEnhancer,
  BaseAnnotations,
  BeforeAll,
  BeforeEach,
  Canvas,
  CleanupCallback,
  ComponentAnnotations,
  ComponentId,
  ComponentTitle,
  Conditional,
  DecoratorApplicator,
  DecoratorFunction,
  Globals,
  GlobalTypes,
  IncludeExcludeOptions,
  InputType,
  LegacyAnnotatedStoryFn,
  LegacyStoryAnnotationsOrFn,
  LegacyStoryFn,
  LoaderFunction,
  Parameters,
  PartialStoryFn,
  PlayFunction,
  PlayFunctionContext,
  ProjectAnnotations as BaseProjectAnnotations,
  SBArrayType,
  SBEnumType,
  SBIntersectionType,
  SBObjectType,
  SBOtherType,
  SBScalarType,
  SBType,
  SBUnionType,
  SeparatorOptions,
  StepFunction,
  StepLabel,
  StepRunner,
  StoryAnnotations,
  StoryAnnotationsOrFn,
  StoryContext,
  StoryContextForEnhancers,
  StoryContextForLoaders,
  StoryContextUpdate,
  StoryFn,
  StoryId,
  StoryIdentifier,
  StoryKind,
  StoryName,
  StrictArgs,
  StrictArgTypes,
  StrictGlobalTypes,
  StrictInputType,
  Tag,
} from '@storybook/core/csf';

type OrString<T extends string> = T | (string & {});

export type ViewMode = OrString<ViewModeBase | 'settings'> | undefined;

type Layout = 'centered' | 'fullscreen' | 'padded' | 'none';

export interface StorybookParameters {
  options?: Addon_OptionsParameter;
  /**
   * The layout property defines basic styles added to the preview body where the story is rendered.
   *
   * If you pass `none`, no styles are applied.
   */
  layout?: Layout;
}

export interface StorybookInternalParameters extends StorybookParameters {
  fileName?: string;
  docsOnly?: true;
}

export type Path = string;
