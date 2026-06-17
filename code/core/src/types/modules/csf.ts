import type { ViewMode as ViewModeBase } from 'storybook/internal/csf';

import type { Addon_OptionsParameterV7 } from './addons.ts';

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
  TestFunction,
  PlayFunction,
  PlayFunctionContext,
  ProjectAnnotations as BaseProjectAnnotations,
  Renderer,
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
  StrictInputType,
  Tag,
} from 'storybook/internal/csf';

type OrString<T extends string> = T | (string & {});

export type ViewMode = OrString<ViewModeBase | 'settings'> | undefined;

type Layout = 'centered' | 'fullscreen' | 'padded' | 'none';

export interface StorybookParameters {
  options?: Addon_OptionsParameterV7;
  /**
   * The layout property defines basic styles added to the preview body where the story is rendered.
   *
   * If you pass `none`, no styles are applied.
   */
  layout?: Layout;
  /**
   * The BCP-47 language tag applied to the rendered story's document.
   *
   * In story view this sets `<html lang>`; in docs view it sets `lang` on the embedded story canvas.
   * Inherited project → meta → story.
   *
   * @default 'en'
   */
  htmlLang?: string;
}

export interface StorybookTypes {
  parameters: StorybookParameters;
}

export interface StorybookInternalParameters extends StorybookParameters {
  fileName?: string;
  docsOnly?: true;
}

export type Path = string;
