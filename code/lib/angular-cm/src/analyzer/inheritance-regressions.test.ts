import { describe, expect, it } from 'vitest';

import { extractArgTypesFromData } from '../extract-arg-types.ts';
import { byName, componentIn } from './__testutils__/inline-source.ts';

describe('generic inheritance', () => {
  it('substitutes a class parameter without touching a constrained nested binder', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      interface Entry { id: string }

      abstract class Base<T> {
        @Input() config!: {
          value: T;
          mapper: <T extends Map<string, number>>(value: T) => T;
        };
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<Entry> {}
    `);

    expect(byName(component.inputsClass, 'config').type).toBe(
      '{ value: Entry; mapper: <T extends Map<string, number>>(value: T) => T; }'
    );
  });

  it('does not rewrite punctuation inside a string literal type', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      abstract class Base<T> {
        @Input() config!: { payload: T; marker: ';}' };
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<string> {}
    `);

    expect(byName(component.inputsClass, 'config').type).toBe('{ payload: string; marker: ";}"; }');
  });

  it('instantiates signal write types and decorator transform types', () => {
    const component = componentIn(`
      import { Component, Input, input } from '@angular/core';

      interface Entry { id: string }
      const stringify = <Value,>(value: Value): string => String(value);

      abstract class Base<T> {
        signalValue = input<string, T>('', { transform: (value: T) => value.id });

        @Input({ transform: (value: T) => value.id })
        propertyValue = '';

        @Input({ transform: (value: T) => value.id })
        set accessorValue(value: string) {}
        get accessorValue(): string { return ''; }

        @Input({ transform: stringify<T[]> })
        genericTransform = '';
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<Entry> {}
    `);

    expect(byName(component.inputsClass, 'signalValue').type).toBe('Entry');
    expect(byName(component.inputsClass, 'propertyValue').type).toBe('Entry');
    expect(byName(component.inputsClass, 'accessorValue').type).toBe('Entry');
    expect(byName(component.inputsClass, 'genericTransform').type).toBe('Entry[]');
  });

  it('instantiates the returned transform from a generic factory call', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      interface Entry { id: string }
      const makeTransform = <Value,>() => (value: Value): string => String(value);

      abstract class Base<T> {
        @Input({ transform: makeTransform<T>() }) value = '';
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<Entry> {}
    `);

    expect(byName(component.inputsClass, 'value').type).toBe('Entry');
  });

  it('instantiates a parenthesized generic transform reference', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      interface Entry { id: string }
      const stringify = <Value,>(value: Value): string => String(value);

      abstract class Base<T> {
        @Input({ transform: (stringify<T>) }) value = '';
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<Entry> {}
    `);

    expect(byName(component.inputsClass, 'value').type).toBe('Entry');
  });

  it('instantiates the implementation signature of an overloaded method', () => {
    const component = componentIn(`
      import { Component } from '@angular/core';

      interface Entry { id: string }

      abstract class Base<T> {
        convert(value: T): T;
        convert(value: T[]): T[];
        convert(value: T | T[]): T | T[] { return value; }
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<Entry> {}
    `);

    expect(byName(component.methodsClass, 'convert')).toMatchObject({
      args: [{ name: 'value', type: 'Entry | Entry[]', optional: false }],
      returnType: 'Entry | Entry[]',
    });
  });

  it('instantiates private, computed, and private signal members by declaration identity', () => {
    const component = componentIn(`
      import { Component, input } from '@angular/core';

      abstract class Base<T> {
        #value!: T;
        ['other']!: T;
        #signal = input<T>();
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base<string> {}
    `);

    expect(byName(component.propertiesClass, '#value').type).toBe('string');
    expect(byName(component.propertiesClass, "['other']").type).toBe('string');
    expect(byName(component.inputsClass, '#signal').type).toBe('string');
  });

  it('keeps an inherited model paired through a type-only redeclaration', () => {
    const component = componentIn(`
      import { Component, Directive, model } from '@angular/core';
      import type { ModelSignal } from '@angular/core';

      @Directive()
      abstract class Base {
        value = model('base');
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Base {
        /** Child-facing value. */
        declare override value: ModelSignal<string>;
      }
    `);

    const argTypes = extractArgTypesFromData(component, {
      metadataJson: undefined,
      propsTable: 'all',
    });
    expect(Object.keys(argTypes)).toEqual(['value', 'valueChange']);
    expect(argTypes.value).toMatchObject({
      description: 'Child-facing value.',
      type: { name: 'string' },
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'base' },
      },
    });
  });

  it('keeps inherited model signal typing through a generic type-only redeclaration', () => {
    const component = componentIn(`
      import { Component, Directive, model } from '@angular/core';
      import type { ModelSignal } from '@angular/core';

      interface Entry { id: string }

      @Directive()
      abstract class Base<T> {
        value = model.required<T>();
      }

      @Directive()
      abstract class Middle<U> extends Base<U> {
        declare override value: ModelSignal<U>;
      }

      @Component({ selector: 'sb-leaf', template: '' })
      export class LeafComponent extends Middle<Entry> {
        declare override value: ModelSignal<Entry>;
      }
    `);

    expect(byName(component.inputsClass, 'value')).toMatchObject({
      type: 'Entry',
      required: true,
    });
    expect(byName(component.outputsClass, 'value').type).toBe('Entry');
  });
});
