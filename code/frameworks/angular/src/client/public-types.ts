/* eslint-disable @typescript-eslint/ban-ts-comment */
import type {
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
import type * as AngularCore from '@angular/core';
import type { AngularRenderer } from './types.ts';

export type { Args, ArgTypes, Parameters, StrictArgs } from 'storybook/internal/types';
export type { Parameters as AngularParameters } from './types.ts';
export type { AngularRenderer };

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/api/csf#default-export)
 */
export type Meta<TArgs = Args> = ComponentAnnotations<
  AngularRenderer,
  TransformComponentType<TArgs>
>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
 */
export type StoryFn<TArgs = Args> = AnnotatedStoryFn<
  AngularRenderer,
  TransformComponentType<TArgs>
>;

/**
 * Story object that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/api/csf#named-story-exports)
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
 * Utility type that transforms InputSignal, ModelSignal, OutputEmitterRef and
 * EventEmitter types.
 *
 * Composition is pinned (do NOT reorder): `TransformModelSignalType` is the
 * INNERMOST wrapper so that (a) the synthesized `${K}Change` key is created
 * before the outer transforms run and passes through them unchanged (it is
 * `(e: E) => void`, which matches none of the Input/Output/Event extends
 * clauses), and (b) since `ModelSignal<T> extends InputSignal<T>`, the model's
 * value field — after `TransformModelSignalType` maps it to `E` — is
 * idempotently re-collapsed by the outer `TransformInputSignalType` to the same
 * `E` (no double-transform divergence).
 */
export type TransformComponentType<T> = TransformInputSignalType<
  TransformOutputSignalType<TransformEventType<TransformModelSignalType<T>>>
>;

// @ts-ignore Angular < 17.2 doesn't export InputSignal
type AngularInputSignal<T> = AngularCore.InputSignal<T>;
// @ts-ignore Angular < 17.2 doesn't export InputSignalWithTransform
type AngularInputSignalWithTransform<T, U> = AngularCore.InputSignalWithTransform<T, U>;
// @ts-ignore Angular < 17.3 doesn't export AngularOutputEmitterRef
type AngularOutputEmitterRef<T> = AngularCore.OutputEmitterRef<T>;
// @ts-ignore Angular < 17.2 doesn't export ModelSignal
type AngularModelSignal<T> = AngularCore.ModelSignal<T>;

type AngularHasInputSignal = typeof AngularCore extends { input: infer U } ? true : false;
type AngularHasOutputSignal = typeof AngularCore extends { output: infer U } ? true : false;
type AngularHasModelSignal = typeof AngularCore extends { model: infer U } ? true : false;

type InputSignal<T> = AngularHasInputSignal extends true ? AngularInputSignal<T> : never;
type InputSignalWithTransform<T, U> = AngularHasInputSignal extends true
  ? AngularInputSignalWithTransform<T, U>
  : never;
type OutputEmitterRef<T> = AngularHasOutputSignal extends true ? AngularOutputEmitterRef<T> : never;
type ModelSignal<T> = AngularHasModelSignal extends true ? AngularModelSignal<T> : never;

type TransformInputSignalType<T> = {
  [K in keyof T]: T[K] extends InputSignal<infer E>
    ? E
    : T[K] extends InputSignalWithTransform<any, infer U>
      ? U
      : T[K];
};

type TransformOutputSignalType<T> = {
  [K in keyof T]: T[K] extends OutputEmitterRef<infer E> ? (e: E) => void : T[K];
};

/**
 * Angular `model()` generates a binding pair: an input `x: T` plus a
 * compiler-synthesized output `xChange: (e: T) => void`. `xChange` is not a real
 * class member, so it cannot be found by iterating `keyof T` and is synthesized
 * here as an intersection member.
 *
 * Known limitation: aliased `model(prop, { alias: 'a' })` produces `aChange` at
 * runtime, but the type layer can only synthesize `${propName}Change` because
 * TypeScript cannot observe the runtime alias. Runtime detection (via `ɵcmp`)
 * still handles aliasing correctly. `model.required()` is fully covered.
 */
type TransformModelSignalType<T> = {
  [K in keyof T]: T[K] extends ModelSignal<infer E> ? E : T[K];
} & {
  [K in keyof T as T[K] extends ModelSignal<infer _E>
    ? `${K & string}Change`
    : never]: T[K] extends ModelSignal<infer E> ? (e: E) => void : never;
};

type TransformEventType<T> = {
  [K in keyof T]: T[K] extends AngularCore.EventEmitter<infer E> ? (e: E) => void : T[K];
};
