import { describe, expect, it } from 'vitest';

import {
  ARG_PATH_PATTERN,
  layoutAttributes,
  printArgPath,
  printValue,
  UnprintableArgError,
  resolveArgPath,
} from './snippetTemplate.ts';

const argPaths = (code: string) => code.match(new RegExp(ARG_PATH_PATTERN, 'g'));

describe('ARG_PATH_PATTERN', () => {
  it('matches dotted, optional and bracketed paths', () => {
    expect(argPaths(`args.a args?.b.c args['d'][0] args["e f"] args?.["g"]`)).toEqual([
      'args.a',
      'args?.b.c',
      "args['d'][0]",
      'args["e f"]',
      'args?.["g"]',
    ]);
  });

  it('matches the path of a spread argument', () => {
    expect(argPaths('<Button {...args.button} />')).toEqual(['args.button']);
  });

  it('skips members of other objects and identifiers that start with args', () => {
    expect(argPaths('story.args.a this?.args.b argsTable.c myargs.d args')).toBeNull();
  });
});

describe('resolveArgPath', () => {
  const args = { label: 'Hi', items: [{ name: 'a' }], style: { color: 'red' }, onClick() {} };

  it('reads an arg, and names it by its key', () => {
    expect(resolveArgPath('args.label', args)).toEqual({ value: 'Hi', rest: '', key: 'label' });
  });

  it('reads into nested data', () => {
    expect(resolveArgPath("args.items[0]['name']", args)).toEqual({
      value: 'a',
      rest: '',
      key: 'name',
    });
    expect(resolveArgPath('args?.style?.color', args)).toEqual({
      value: 'red',
      rest: '',
      key: 'color',
    });
  });

  it('stops at members that are not arg data', () => {
    expect(resolveArgPath('args.items.map', args)).toEqual({
      value: args.items,
      rest: '.map',
      key: 'items',
    });
    expect(resolveArgPath('args.label.length', args)).toMatchObject({ rest: '.length' });
    expect(resolveArgPath('args.onClick.name', args)).toMatchObject({
      value: args.onClick,
      rest: '.name',
      key: 'onClick',
    });
  });

  it('resolves an unset arg to undefined', () => {
    expect(resolveArgPath('args.missing.deep', args)).toEqual({
      value: undefined,
      rest: '.deep',
      key: 'missing',
    });
  });

  it('does not read inherited properties', () => {
    expect(resolveArgPath('args.style.toString', args)).toMatchObject({
      value: args.style,
      rest: '.toString',
    });
  });
});

describe('printArgPath', () => {
  it('prints the arg and keeps the rest of the path as written', () => {
    expect(printArgPath('args.label.toUpperCase()', { label: 'go' })).toBe('"go".toUpperCase()');
  });

  it('names a value it cannot print by the arg the path reads, not by the rest', () => {
    const rows = Array.from({ length: 100 }, (_, id) => ({ id }));
    expect(printArgPath('args.rows.map', { rows })).toBe('rows.map');
    expect(printArgPath('args.onClick.bind', { onClick: () => {} })).toBe('onClick.bind');
  });

  it('wraps numbers and bigints that would otherwise read differently', () => {
    expect(printArgPath('args.count.toFixed', { count: 3 })).toBe('(3).toFixed');
    expect(printArgPath('args.delta', { delta: -1 })).toBe('(-1)');
    expect(printArgPath('args.count', { count: 3 })).toBe('3');
    expect(printArgPath('args.delta', { delta: -1n })).toBe('(-1n)');
  });
});

describe('printValue', () => {
  it('prints primitives as literals', () => {
    expect(printValue('Say "hi"\n')).toBe(String.raw`"Say \"hi\"\n"`);
    expect(printValue('a\\b\t')).toBe(String.raw`"a\\b\t"`);
    expect(printValue("It's", { quote: "'" })).toBe(String.raw`'It\'s'`);
    expect(printValue(3)).toBe('3');
    expect(printValue(false)).toBe('false');
    expect(printValue(null)).toBe('null');
    expect(printValue(undefined)).toBe('undefined');
    expect(printValue(10n)).toBe('10n');
  });

  it('prints dates as constructor calls', () => {
    expect(printValue(new Date('2024-01-02T03:04:05.000Z'))).toBe(
      'new Date("2024-01-02T03:04:05.000Z")'
    );
  });

  it('prints plain objects and arrays as literals', () => {
    expect(
      printValue({ color: 'red', 'z-index': 1, nested: [1, { a: true }], unset: undefined })
    ).toBe('{ color: "red", "z-index": 1, nested: [1, { a: true }] }');
    expect(printValue([])).toBe('[]');
    expect(printValue({})).toBe('{}');
  });

  it('prints a function as the name it is passed as', () => {
    expect(printValue(() => {}, { name: 'onClick' })).toBe('onClick');
    expect(printValue({ onSelect: () => {} })).toBe('{ onSelect }');
    expect(printValue([() => {}], { name: 'handlers' })).toBe('handlers');
    expect(() => printValue([() => {}])).toThrow(UnprintableArgError);
    expect(() => printValue(() => {}, { name: 'data-click' })).toThrow(UnprintableArgError);
    expect(() => printValue({ 'data-rows': [new Map()] })).toThrow(UnprintableArgError);
    expect(() => printValue({ default: () => {} })).toThrow(UnprintableArgError);
    expect(printValue({ default: 1, '1': 1, true: true })).toBe(
      '{ "1": 1, default: 1, true: true }'
    );
  });

  it('prints values without a readable literal as their name', () => {
    class Store {}
    expect(printValue(new Store(), { name: 'store' })).toBe('store');
    expect(printValue(new Map(), { name: 'lookup' })).toBe('lookup');
    expect(printValue(Symbol('s'), { name: 'token' })).toBe('token');
    expect(printValue({ store: new Store() })).toBe('{ store }');
  });

  it('prints values too deep or too long to read as their name', () => {
    expect(printValue({ a: { b: { c: { d: { e: 1 } } } } }, { name: 'deep' })).toBe(
      '{ a: { b: { c: { d } } } }'
    );
    const rows = Array.from({ length: 200 }, (_, id) => ({ id }));
    expect(printValue(rows, { name: 'rows' })).toBe('rows');
    expect(printValue({ rows })).toBe('{ rows }');
  });

  it('lets the renderer print its own values', () => {
    const element = { $$typeof: Symbol.for('react.element') };
    const printCustom = (value: unknown) => (value === element ? '<Icon />' : undefined);
    expect(printValue({ icon: element }, { printCustom })).toBe('{ icon: <Icon /> }');
  });
});

describe('layoutAttributes', () => {
  it('keeps short attribute lists on the line', () => {
    expect(layoutAttributes(['primary', 'label="Hi"'], '<Button {...args} />', 8, ' />')).toBe(
      ' primary label="Hi" />'
    );
    expect(layoutAttributes([], '<Button {...args} />', 8, ' />')).toBe(' />');
  });

  it('puts long attribute lists one per line, indented under the element', () => {
    const code = '  <Button {...args} />';
    const attributes = ['primary', 'label="A long label value"', 'size="large"', 'disabled'];
    expect(layoutAttributes(attributes, code, 10, ' />')).toBe(
      '\n    primary\n    label="A long label value"\n    size="large"\n    disabled\n  />'
    );
    expect(layoutAttributes(attributes, code, 10)).toBe(
      '\n    primary\n    label="A long label value"\n    size="large"\n    disabled\n   '
    );
  });
});
