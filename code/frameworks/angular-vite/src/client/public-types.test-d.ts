import { describe, expectTypeOf, it } from 'vitest';

import { EventEmitter, Input, Output, input, model, numberAttribute, output } from '@angular/core';

import type { TransformComponentType } from './public-types.ts';

/**
 * Type-inference coverage for Angular `model()` signal outputs, asserted on the
 * composed `TransformComponentType<C>` alongside the existing
 * input()/output()/EventEmitter/@Input/@Output channels to guard regressions.
 *
 * Aliased `model(prop, { alias })` is a known gap: the type layer can only
 * synthesize `${propName}Change` because TypeScript cannot observe the runtime
 * alias. Runtime detection via `ɵcmp` resolves the alias correctly.
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

describe('TransformComponentType — model() signal outputs', () => {
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
    // `numberAttribute` types the signal as `InputSignalWithTransform<number,
    // unknown>`, so `TransformInputSignalType` surfaces the accepted input type
    // `unknown`. Unchanged by model() support; pins the no-regression baseline.
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
