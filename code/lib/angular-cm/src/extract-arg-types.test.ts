/**
 * How a declared input type reaches the props table, as both a summary and a control.
 *
 * The sources go through the real analyzer rather than hand-written type strings, because the two
 * halves drifting apart is the defect this guards: `TypeIndex.render` learned to emit `new ` and
 * `<T>` prefixes while the sbType predicate still only accepted a leading `(`, so a correct summary
 * came at the cost of the control. Feeding the predicate strings a test author picked would not
 * have caught that.
 */
import { describe, expect, it } from 'vitest';

import { componentIn } from './analyzer/__testutils__/inline-source.ts';
import { extractArgTypesFromData } from './extract-arg-types.ts';

const inputTyped = (type: string) => {
  const component = componentIn(`
    import { Component, Input } from '@angular/core';

    export class Thing {}

    @Component({ selector: 'sb-probe', template: '' })
    export class ProbeComponent {
      @Input() value!: ${type};
    }
  `);
  return extractArgTypesFromData(component, { metadataJson: undefined, propsTable: 'all' }).value;
};

const FUNCTION_CONTROL = { name: 'function' };

describe('function-typed inputs', () => {
  it('keeps the signature and the function control for a plain arrow type', () => {
    const arg = inputTyped('(value: number) => string');
    expect(arg.table?.type?.summary).toBe('(value: number) => string');
    expect(arg.type).toEqual(FUNCTION_CONTROL);
  });

  it('keeps both for optional and rest parameters', () => {
    const arg = inputTyped('(a?: string, ...rest: number[]) => void');
    expect(arg.table?.type?.summary).toBe('(a?: string, ...rest: number[]) => void');
    expect(arg.type).toEqual(FUNCTION_CONTROL);
  });

  it('keeps both for a generic signature, whose rendered type leads with its type parameters', () => {
    const arg = inputTyped('<T>(value: T) => T');
    expect(arg.table?.type?.summary).toBe('<T>(value: T) => T');
    expect(arg.type).toEqual(FUNCTION_CONTROL);
  });

  it('keeps both for a constructor type, whose rendered type leads with `new`', () => {
    const arg = inputTyped('new (value: number) => Thing');
    expect(arg.table?.type?.summary).toBe('new (value: number) => Thing');
    expect(arg.type).toEqual(FUNCTION_CONTROL);
  });

  it('keeps both for a generic constructor type, which leads with both', () => {
    const arg = inputTyped('new <T>(value: T) => Thing');
    expect(arg.table?.type?.summary).toBe('new <T>(value: T) => Thing');
    expect(arg.type).toEqual(FUNCTION_CONTROL);
  });

  it('does not read a type that merely mentions a signature as a function', () => {
    const arg = inputTyped('Array<(value: number) => string>');
    expect(arg.table?.type?.summary).toBe('Array<(value: number) => string>');
    expect(arg.type).not.toEqual(FUNCTION_CONTROL);
  });
});
