import { describe, expectTypeOf, it } from 'vitest';

import { EventEmitter, Input, Output, input, model, numberAttribute, output } from '@angular/core';

import type { TransformComponentType } from './public-types.ts';

/**
 * Layer A (type inference) regression suite for Angular `model()` signal
 * outputs.
 *
 * Assertions are made on the FINAL composed `TransformComponentType<C>` (NOT
 * `TransformModelSignalType` in isolation), proving the pinned innermost
 * composition resolves the synthesized `${prop}Change` key and the model value
 * field SIMULTANEOUSLY in one composed type, with zero regression to the
 * existing `input()` / `output()` / `EventEmitter` / `@Input` / `@Output`
 * channels.
 *
 * Known limitation (also recorded for the AC-X3 changelog): aliased
 * `model(prop, { alias: 'a' })` produces `aChange` at runtime, but Layer A can
 * only synthesize `${propName}Change`. Runtime detection (Layer C) handles the
 * alias correctly via the resolved binding name on `ɵcmp`.
 */
class C {
  color = model<string>();
  reqd = model.required<boolean>();
  plain = input<string>();
  withT = input(0, { transform: numberAttribute });
  evt = output<string>();
  ee = new EventEmitter<number>();
  @Input() decIn!: string;
  @Output() decOut = new EventEmitter<void>();
}

type Transformed = TransformComponentType<C>;

describe('TransformComponentType — model() signal outputs (Layer A)', () => {
  it('maps a model() field to its value type and synthesizes ${prop}Change', () => {
    expectTypeOf<Transformed['color']>().toEqualTypeOf<string>();
    expectTypeOf<Transformed['colorChange']>().toEqualTypeOf<(e: string) => void>();
  });

  it('covers model.required() identically to model()', () => {
    expectTypeOf<Transformed['reqd']>().toEqualTypeOf<boolean>();
    expectTypeOf<Transformed['reqdChange']>().toEqualTypeOf<(e: boolean) => void>();
  });

  it('does not regress input() signal inputs', () => {
    expectTypeOf<Transformed['plain']>().toEqualTypeOf<string>();
  });

  it('does not regress transform input() signal inputs', () => {
    // Pre-existing, unchanged behavior of `TransformInputSignalType`: it
    // extracts the WRITE/transform-input type `U` from
    // `InputSignalWithTransform<T, infer U>`. `numberAttribute` has signature
    // `(value: unknown) => number`, so the signal is
    // `InputSignalWithTransform<number, unknown>` and the transform surfaces
    // `unknown` (the accepted bound input). Layer A does not alter this; this
    // assertion pins the no-regression baseline.
    expectTypeOf<Transformed['withT']>().toEqualTypeOf<unknown>();
  });

  it('does not regress output() signal outputs', () => {
    expectTypeOf<Transformed['evt']>().toEqualTypeOf<(e: string) => void>();
  });

  it('does not regress EventEmitter outputs', () => {
    expectTypeOf<Transformed['ee']>().toEqualTypeOf<(e: number) => void>();
  });

  it('does not regress @Input decorator inputs', () => {
    expectTypeOf<Transformed['decIn']>().toEqualTypeOf<string>();
  });

  it('does not regress @Output decorator outputs', () => {
    expectTypeOf<Transformed['decOut']>().toEqualTypeOf<(e: void) => void>();
  });
});
