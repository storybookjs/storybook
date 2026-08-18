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

const shownDefault = (classBody: string, topLevel = '') => {
  const component = componentIn(`
    import { Component, Input, computed } from '@angular/core';

    ${topLevel}

    @Component({ selector: 'sb-probe', template: '' })
    export class ProbeComponent {
      ${classBody}
    }
  `);
  const argTypes = extractArgTypesFromData(component, {
    metadataJson: undefined,
    propsTable: 'all',
  });
  return argTypes.value.table?.defaultValue?.summary;
};

describe('literal initializers reach the default column', () => {
  it('keeps a single-quoted string, without its quotes', () => {
    expect(shownDefault(`@Input() value = 'primary';`)).toBe('primary');
  });

  it('keeps a double-quoted string, without its quotes', () => {
    expect(shownDefault(`@Input() value = "start";`)).toBe('start');
  });

  it('keeps a number', () => {
    expect(shownDefault(`@Input() value = 42;`)).toBe(42);
  });

  it('keeps a negated number', () => {
    expect(shownDefault(`@Input() value = -1;`)).toBe(-1);
  });

  it('keeps a boolean', () => {
    expect(shownDefault(`@Input() value = false;`)).toBe(false);
  });

  it('keeps an enum member reference', () => {
    expect(shownDefault(`@Input() value = Foo.Bar;`, `export enum Foo { Bar = 'bar' }`)).toBe(
      'Foo.Bar'
    );
  });

  it('keeps an empty array literal', () => {
    expect(shownDefault(`@Input() value = [];`)).toBe('[]');
  });

  it('keeps a simple object literal', () => {
    expect(shownDefault(`@Input() value = { a: 1 };`)).toBe('{ a: 1 }');
  });
});

describe('non-literal initializers are hidden from the default column', () => {
  it('hides a `this.` reference instead of printing its source', () => {
    expect(
      shownDefault(`
        private _config = { variant: 'primary' };

        @Input() value = this._config.variant;
      `)
    ).toBeUndefined();
  });

  it('hides a call expression', () => {
    expect(
      shownDefault(
        `@Input() value = injectBrnDialogDefaultOptions();`,
        `export const injectBrnDialogDefaultOptions = () => ({ closeDelay: 0 });`
      )
    ).toBeUndefined();
  });

  it('hides a `computed(...)` value', () => {
    expect(shownDefault(`@Input() value = computed(() => false);`)).toBeUndefined();
  });

  it('hides a `new` expression', () => {
    expect(shownDefault(`@Input() value = new Map<string, string>();`)).toBeUndefined();
  });

  it('hides an interpolated template literal', () => {
    expect(
      shownDefault(`@Input() value = \`item-\${nextId++}\`;`, `let nextId = 0;`)
    ).toBeUndefined();
  });

  it('hides a bare identifier that only names a constant', () => {
    expect(
      shownDefault(
        `@Input() value = DEFAULT_ORIENTATION;`,
        `const DEFAULT_ORIENTATION = 'horizontal';`
      )
    ).toBeUndefined();
  });
});

describe('authored default tags', () => {
  it('lets a camel-case @defaultValue tag stand in for a hidden initializer', () => {
    expect(
      shownDefault(
        `
        /** @defaultValue 'horizontal' */
        @Input() value = DEFAULT_ORIENTATION;
      `,
        `const DEFAULT_ORIENTATION = 'horizontal';`
      )
    ).toBe('horizontal');
  });

  it('lets an authored @default tag win over a literal initializer', () => {
    expect(
      shownDefault(`
        /** @default 'horizontal' */
        @Input() value = 'vertical';
      `)
    ).toBe('horizontal');
  });
});
