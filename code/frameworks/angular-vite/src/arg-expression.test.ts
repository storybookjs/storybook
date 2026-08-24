import { describe, expect, it } from 'vitest';

import { escapeAttributeExpression, printArgExpression } from './arg-expression.ts';

describe('printArgExpression', () => {
  it('single-quotes a string and escapes what the quoting introduces', () => {
    expect(printArgExpression('Save')).toBe("'Save'");
    expect(printArgExpression('')).toBe("''");
    expect(printArgExpression("it's")).toBe("'it\\'s'");
    expect(printArgExpression('say "hi"')).toBe('\'say "hi"\'');
    expect(printArgExpression('a\nb')).toBe("'a\\nb'");
    expect(printArgExpression('a\r\nb')).toBe("'a\\r\\nb'");
    expect(printArgExpression('back\\slash')).toBe("'back\\\\slash'");
    expect(printArgExpression('Tom & Jerry')).toBe("'Tom & Jerry'");
  });

  it('prints supported primitives as their literal text', () => {
    expect(printArgExpression(42)).toBe('42');
    expect(printArgExpression(-1)).toBe('-1');
    expect(printArgExpression(-0)).toBe('-0');
    expect(printArgExpression(true)).toBe('true');
    expect(printArgExpression(null)).toBe('null');
    expect(printArgExpression(undefined)).toBe('undefined');
  });

  it('declines non-finite numbers because Angular reads them as component members', () => {
    expect(printArgExpression(Number.NaN)).toBeUndefined();
    expect(printArgExpression(Infinity)).toBeUndefined();
    expect(printArgExpression(-Infinity)).toBeUndefined();
  });

  it('prints arrays and objects with unquoted identifier keys and spaced separators', () => {
    expect(printArgExpression([1, 2])).toBe('[1, 2]');
    expect(printArgExpression([[1], [2]])).toBe('[[1], [2]]');
    expect(printArgExpression({ a: 1, b: 'two' })).toBe("{a: 1, b: 'two'}");
    expect(printArgExpression({ 'not-an-ident': 1 })).toBe("{'not-an-ident': 1}");
  });

  it('prints a sparse hole as null rather than leaving a gap Angular cannot parse', () => {
    expect(printArgExpression([, 1])).toBe('[null, 1]');
    expect(printArgExpression([1, , 2])).toBe('[1, null, 2]');
    expect(printArgExpression(new Array(3))).toBe('[null, null, null]');
  });

  it('preserves explicit undefined entries', () => {
    expect(printArgExpression({ a: 1, b: undefined })).toBe('{a: 1, b: undefined}');
    expect(printArgExpression([1, undefined, 2])).toBe('[1, undefined, 2]');
  });

  it('declines a circular reference rather than inventing a placeholder for it', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    expect(printArgExpression(circular)).toBeUndefined();
  });

  it('prints an acyclic shared reference each time it appears', () => {
    const shared = { value: 1 };

    expect(printArgExpression({ first: shared, second: shared })).toBe(
      '{first: {value: 1}, second: {value: 1}}'
    );
  });

  // An Angular template expression may only name the component's own members, so none of these has
  // a form here. Declining leaves the caller's existing snippet in place; printing `{}` or a bare
  // `Symbol('x')` would put source in front of a reader that does not mean what it says.
  it('declines a value with no Angular expression form', () => {
    expect(printArgExpression(Symbol('fixture'))).toBeUndefined();
    expect(printArgExpression(10n)).toBeUndefined();
    expect(printArgExpression((value: number) => value + 1)).toBeUndefined();
    expect(printArgExpression(new Date(Date.UTC(2010, 1, 1)))).toBeUndefined();
    expect(printArgExpression(/ab+c/g)).toBeUndefined();
    expect(printArgExpression(new Map([['k', 'v']]))).toBeUndefined();
    expect(printArgExpression(new Set([1]))).toBeUndefined();
    expect(printArgExpression(new (class Widget {})())).toBeUndefined();
  });

  it('declines a whole value when anything nested inside it has no form', () => {
    expect(printArgExpression({ when: new Date() })).toBeUndefined();
    expect(printArgExpression([1, () => {}])).toBeUndefined();
    expect(printArgExpression({ nested: { deep: Symbol('x') } })).toBeUndefined();
  });
});

describe('escapeAttributeExpression', () => {
  it('encodes the attribute delimiter', () => {
    expect(escapeAttributeExpression('\'say "hi"\'')).toBe("'say &quot;hi&quot;'");
  });

  it('encodes an ampersand only where Angular would decode a character reference', () => {
    expect(escapeAttributeExpression("'Tom & Jerry'")).toBe("'Tom & Jerry'");
    expect(escapeAttributeExpression("'Tom &amp; Jerry'")).toBe("'Tom &amp;amp; Jerry'");
    expect(escapeAttributeExpression("'5 &#38; 6'")).toBe("'5 &amp;#38; 6'");
  });
});
