/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  AnnotatedStoryFn,
  Args,
  ComponentAnnotations,
  DecoratorFunction,
  LoaderFunction,
  StoryAnnotations,
  StoryContext as GenericStoryContext,
  StrictArgs,
  ProjectAnnotations,
} from 'storybook/internal/types';
import * as AngularCore from '@angular/core';
import { AngularRenderer } from './types';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { Parameters as AngularParameters } from './types';
export type { AngularRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<
  AngularRenderer,
  TransformComponentType<TArgs>
>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<
  AngularRenderer,
  TransformComponentType<TArgs>
>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryObj<TArgs = Args> = StoryAnnotations<
  AngularRenderer,
  TransformComponentType<TArgs>
>;

export type Decorator<TArgs = StrictArgs> = DecoratorFunction<AngularRenderer, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<AngularRenderer, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<AngularRenderer, TArgs>;
export type Preview = ProjectAnnotations<AngularRenderer>;

/**
 * Utility type that transforms InputSignal and EventEmitter types
 */
type TransformComponentType<T> = TransformInputSignalType<TransformOutputSignalType<TransformEventType<T>>>

// @ts-ignore Angular < 17.2 doesn't export InputSignal
type AngularInputSignal<T> = AngularCore.InputSignal<T>
// @ts-ignore Angular < 17.2 doesn't export InputSignalWithTransform
type AngularInputSignalWithTransform<T, U> = AngularCore.InputSignalWithTransform<T, U>
// @ts-ignore Angular < 17.3 doesn't export AngularOutputEmitterRef
type AngularOutputEmitterRef<T> = AngularCore.OutputEmitterRef<T>

type AngularHasInputSignal = typeof AngularCore extends { input: infer U } ? true : false;
type AngularHasOutputSignal = typeof AngularCore extends { output: infer U } ? true : false;

type InputSignal<T> = AngularHasInputSignal extends true ? AngularInputSignal<T> : never;
type InputSignalWithTransform<T, U> = AngularHasInputSignal extends true ? AngularInputSignalWithTransform<T, U> : never;
type OutputEmitterRef<T> = AngularHasOutputSignal extends true ? AngularOutputEmitterRef<T> : never;

type TransformInputSignalType<T> = {
   [K in keyof T]: T[K] extends InputSignal<infer E> ? E : T[K] extends InputSignalWithTransform<any, infer U> ? U : T[K];
};

type TransformOutputSignalType<T> = {
  [K in keyof T]: T[K] extends OutputEmitterRef<infer E> ? (e: E) => void : T[K];
};

type TransformEventType<T> = {
  [K in keyof T]: T[K] extends AngularCore.EventEmitter<infer E> ? (e: E) => void : T[K];
};
