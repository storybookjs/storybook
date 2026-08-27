/**
 * How a declared input type reaches the props table, as both a summary and a control.
 *
 * The sources go through the real analyzer rather than hand-written type strings, because the two
 * halves drifting apart is the defect this guards: `TypeIndex.render` learned to emit `new ` and
 * `<T>` prefixes while the sbType predicate still only accepted a leading `(`, so a correct summary
 * came at the cost of the control. Feeding the predicate strings a test author picked would not
 * have caught that.
 */
import { describe, expect, it, vi } from 'vitest';

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

// `inputTyped` declares an input with no default, so every control it produces is also a required
// one.
const FUNCTION_CONTROL = { name: 'function', required: true };

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

describe('primitive-union inputs', () => {
  it('keeps the boolean control and the write-union summary for the canonical booleanAttribute input', () => {
    const component = componentIn(`
      import { Component, booleanAttribute, input } from '@angular/core';

      @Component({ selector: 'sb-probe', template: '' })
      export class ProbeComponent {
        value = input<boolean, boolean | string>(false, { transform: booleanAttribute });
      }
    `);
    const arg = extractArgTypesFromData(component, {
      metadataJson: undefined,
      propsTable: 'all',
    }).value;

    expect(arg.type).toEqual({ name: 'boolean' });
    expect(arg.table?.type?.summary).toBe('boolean | string');
  });

  it('keeps the number control and the write-union summary for the canonical numberAttribute input', () => {
    const component = componentIn(`
      import { Component, input, numberAttribute } from '@angular/core';

      @Component({ selector: 'sb-probe', template: '' })
      export class ProbeComponent {
        value = input<number, number | string>(0, { transform: numberAttribute });
      }
    `);
    const arg = extractArgTypesFromData(component, {
      metadataJson: undefined,
      propsTable: 'all',
    }).value;

    expect(arg.type).toEqual({ name: 'number' });
    expect(arg.table?.type?.summary).toBe('number | string');
  });

  it('keeps the boolean control for a hand-written coercion transform on an @Input', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      @Component({ selector: 'sb-probe', template: '' })
      export class ProbeComponent {
        @Input({ transform: (value: string | boolean) => value === '' || !!value }) value = false;
      }
    `);
    const arg = extractArgTypesFromData(component, {
      metadataJson: undefined,
      propsTable: 'all',
    }).value;

    expect(arg.type).toEqual({ name: 'boolean' });
  });

  it('prefers number over string for a declared primitive union', () => {
    const arg = inputTyped('string | number');
    expect(arg.type).toEqual({ name: 'number', required: true });
    expect(arg.table?.type?.summary).toBe('string | number');
  });

  it('leaves a union that mixes a primitive with a named type on the catch-all', () => {
    const arg = inputTyped('string | Thing');
    expect(arg.type).toEqual({ name: 'other', value: 'empty-enum', required: true });
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

  it('keeps an interpolation-free template, without its delimiters', () => {
    expect(shownDefault(`@Input() value = \`start\`;`)).toBe('start');
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

  it('keeps a scientific-notation number, as its numeric value', () => {
    expect(shownDefault(`@Input() value = 1e3;`)).toBe(1000);
  });

  it('keeps a negative scientific-notation number', () => {
    expect(shownDefault(`@Input() value = -1.5e-3;`)).toBe(-0.0015);
  });

  it('keeps a negative bigint in source form', () => {
    expect(shownDefault(`@Input() value = -42n;`)).toBe('-42n');
  });

  it('keeps a hex number', () => {
    expect(shownDefault(`@Input() value = 0xFF;`)).toBe(255);
  });

  it('keeps a binary number', () => {
    expect(shownDefault(`@Input() value = 0b101;`)).toBe(5);
  });

  it('keeps a number with numeric separators, as its source spelling', () => {
    expect(shownDefault(`@Input() value = 1_000;`)).toBe('1_000');
  });

  it('keeps a unary-plus number', () => {
    expect(shownDefault(`@Input() value = +1;`)).toBe(1);
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

  it('keeps an object literal whose string value spells `this`', () => {
    expect(shownDefault(`@Input() value = { hint: 'do this now' };`)).toBe(
      "{ hint: 'do this now' }"
    );
  });

  it('keeps an object literal whose string value spells `new`', () => {
    expect(shownDefault(`@Input() value = { label: 'Create new item' };`)).toBe(
      "{ label: 'Create new item' }"
    );
  });

  it('keeps an array literal whose string element contains parens', () => {
    expect(shownDefault(`@Input() value = ['(none)', 'all'];`)).toBe("['(none)', 'all']");
  });

  it('keeps recursively literal arrays and objects', () => {
    expect(
      shownDefault(
        `@Input() value = { tones: [Tone.Primary, { label: 'ready', enabled: true }] };`,
        `enum Tone { Primary = 'primary' }`
      )
    ).toBe("{ tones: [Tone.Primary, { label: 'ready', enabled: true }] }");
  });

  it('shows the literal inside type-only wrappers', () => {
    expect(shownDefault(`@Input() value = ('ready' as const)!;`)).toBe('ready');
  });

  it.each(['false', 'null', 'undefined'])('keeps the string literal %j as a string', (value) => {
    expect(shownDefault(`@Input() value: '${value}' = "${value}";`)).toBe(value);
  });
});

describe('non-literal initializers are hidden from the default column', () => {
  it('hides an object literal that spreads a runtime value', () => {
    expect(shownDefault(`@Input() value = { ...defaults };`, `const defaults = { a: 1 };`)).toBe(
      undefined
    );
  });

  it('hides an object literal with a shorthand property naming a constant', () => {
    expect(shownDefault(`@Input() value = { option };`, `const option = 1;`)).toBe(undefined);
  });

  it('hides an object literal with a computed key', () => {
    expect(
      shownDefault(`@Input() value = { [key]: 1 };`, `const key = 'a'; const value2 = 1;`)
    ).toBe(undefined);
  });

  it('hides an array literal whose element only names a constant', () => {
    expect(shownDefault(`@Input() value = [DEFAULT];`, `const DEFAULT = 1;`)).toBe(undefined);
  });

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

  it('hides a shadowed undefined identifier', () => {
    expect(
      shownDefault(
        `@Input() value = undefined;`,
        `const undefined = runtime(); const runtime = () => 7;`
      )
    ).toBeUndefined();
  });

  it('hides an arbitrary dotted value and logs its source', () => {
    const component = componentIn(`
      import { Component, Input } from '@angular/core';

      const settings = { orientation: 'horizontal' };

      @Component({ selector: 'sb-probe', template: '' })
      export class ProbeComponent {
        @Input() value = settings.orientation;
      }
    `);
    const debug = vi.fn();
    const argTypes = extractArgTypesFromData(component, {
      metadataJson: undefined,
      propsTable: 'all',
      logger: { debug, warn: vi.fn() },
    });

    expect(argTypes.value.table?.defaultValue?.summary).toBeUndefined();
    expect(debug).toHaveBeenCalledWith(
      "value: non-literal default 'settings.orientation' not shown"
    );
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

const argTypesOf = (classBody: string) => {
  const component = componentIn(`
    import { Component, Input, input, output } from '@angular/core';

    @Component({ selector: 'sb-probe', template: '' })
    export class ProbeComponent {
      ${classBody}
    }
  `);
  return extractArgTypesFromData(component, { metadataJson: undefined, propsTable: 'all' });
};

/**
 * Where the required flag lives, which is the whole of this defect.
 *
 * Every consumer - the props table badge and its sort order, the generated dummy args, the
 * `apiDescription` an agent reads - takes it from `type.required`, the field `SBBaseType` declares.
 * Recording it anywhere else documents nothing, so `table.type` must stay free of it.
 */
describe('the required flag', () => {
  it('marks a signal input declared with `input.required`', () => {
    expect(argTypesOf(`value = input.required<string>();`).value.type).toEqual({
      name: 'string',
      required: true,
    });
  });

  it('marks a decorator input with no initializer', () => {
    expect(argTypesOf(`@Input() value!: string;`).value.type).toEqual({
      name: 'string',
      required: true,
    });
  });

  it('says nothing about a defaulted signal input', () => {
    expect(argTypesOf(`value = input('');`).value.type).toEqual({ name: 'string' });
  });

  it('says nothing about a defaulted decorator input', () => {
    expect(argTypesOf(`@Input() value = 'primary';`).value.type).toEqual({ name: 'string' });
  });

  it('says nothing about an optional input', () => {
    expect(argTypesOf(`@Input() value?: string;`).value.type).toEqual({ name: 'string' });
  });

  it('says nothing about an output, which a parent is never obliged to bind', () => {
    expect(argTypesOf(`toggled = output<boolean>();`).toggled.type).toEqual({
      name: 'other',
      value: 'void',
    });
  });

  it('says nothing about a plain property, which a parent cannot bind at all', () => {
    expect(argTypesOf(`value!: string;`).value.type).toEqual({ name: 'string' });
  });

  it('leaves `table.type` carrying the summary alone', () => {
    const table = argTypesOf(`value = input.required<string>();`).value.table;
    expect(table?.type).toEqual({ summary: 'string' });
  });
});
