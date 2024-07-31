import { describe, it, expect, vi } from 'vitest';
import { parseArgsParam } from './parseArgsParam';

vi.mock('@storybook/core/client-logger', () => ({
  once: { warn: vi.fn() },
}));

describe('parseArgsParam', () => {
  it('parses a simple key-value pair', () => {
    const args = parseArgsParam('key:val');
    expect(args).toStrictEqual({ key: 'val' });
  });

  it('parses spaces', () => {
    const args = parseArgsParam('key:one+two+three');
    expect(args).toStrictEqual({ key: 'one two three' });
  });

  it('parses null', () => {
    const args = parseArgsParam('key:!null');
    expect(args).toStrictEqual({ key: null });
  });

  it('parses undefined', () => {
    const args = parseArgsParam('key:!undefined');
    expect(args).toStrictEqual({ key: undefined });
  });

  it('parses true', () => {
    const args = parseArgsParam('key:!true');
    expect(args).toStrictEqual({ key: true });
  });

  it('parses false', () => {
    const args = parseArgsParam('key:!false');
    expect(args).toStrictEqual({ key: false });
  });

  it('parses hex color values', () => {
    const args = parseArgsParam('key:!hex(ff4785)');
    expect(args).toStrictEqual({ key: '#ff4785' });
  });

  it('parses rgba color values', () => {
    const args = parseArgsParam('rgb:!rgb(255,71,133);rgba:!rgba(255,71,133,0.5)');
    expect(args).toStrictEqual({ rgb: 'rgb(255, 71, 133)', rgba: 'rgba(255, 71, 133, 0.5)' });
  });

  it('parses hsla color values', () => {
    const args = parseArgsParam('hsl:!hsl(45,99,70);hsla:!hsla(45,99,70,0.5)');
    expect(args).toStrictEqual({ hsl: 'hsl(45, 99%, 70%)', hsla: 'hsla(45, 99%, 70%, 0.5)' });
  });

  it('parses Date', () => {
    const args = parseArgsParam('key:!date(2001-02-03T04:05:06.789Z)');
    expect(args).toStrictEqual({ key: new Date('2001-02-03T04:05:06.789Z') });
  });

  it('parses Date with timezone offset', () => {
    const args = parseArgsParam('key:!date(2001-02-03T04:05:06.789+09:00)');
    expect(args).toStrictEqual({ key: new Date('2001-02-03T04:05:06.789+09:00') });
  });

  it('parses Date without timezone', () => {
    const args = parseArgsParam('key:!date(2001-02-03T04:05:06.789)');
    expect(args).toStrictEqual({ key: expect.any(Date) }); // depends on local timezone
  });

  it('parses Date without second fraction', () => {
    const args = parseArgsParam('key:!date(2001-02-03T04:05:06Z)');
    expect(args).toStrictEqual({ key: new Date('2001-02-03T04:05:06.000Z') });
  });

  it('parses Date without time', () => {
    const args = parseArgsParam('key:!date(2001-02-03)');
    expect(args).toStrictEqual({ key: expect.any(Date) }); // depends on local timezone
  });

  it('does not parse Date without prefix', () => {
    const args = parseArgsParam('key:2001-02-03T04:05:06.789Z');
    expect(args).toStrictEqual({});
  });

  it('parses multiple values', () => {
    const args = parseArgsParam('one:A;two:B;three:C');
    expect(args).toStrictEqual({ one: 'A', two: 'B', three: 'C' });
  });

  it('parses arrays', () => {
    const args = parseArgsParam('arr[]:A;arr[]:B;arr[]:C');
    expect(args).toStrictEqual({ arr: ['A', 'B', 'C'] });
  });

  it('parses arrays with indices', () => {
    const args = parseArgsParam('arr[0]:A;arr[1]:B;arr[2]:C');
    expect(args).toStrictEqual({ arr: ['A', 'B', 'C'] });
  });

  it('parses sparse arrays', () => {
    const args = parseArgsParam('arr[0]:A;arr[2]:C');

    expect(args).toStrictEqual({ arr: ['A', , 'C'] });
  });

  it('parses repeated values as arrays', () => {
    const args = parseArgsParam('arr:A;arr:B;arr:C');
    expect(args).toStrictEqual({ arr: ['A', 'B', 'C'] });
  });

  it('parses simple objects', () => {
    const args = parseArgsParam('obj.one:A;obj.two:B');
    expect(args).toStrictEqual({ obj: { one: 'A', two: 'B' } });
  });

  it('parses nested objects', () => {
    const args = parseArgsParam('obj.foo.one:A;obj.foo.two:B;obj.bar.one:A');
    expect(args).toStrictEqual({ obj: { foo: { one: 'A', two: 'B' }, bar: { one: 'A' } } });
  });

  it('parses arrays in objects', () => {
    expect(parseArgsParam('obj.foo[]:A;obj.foo[]:B')).toStrictEqual({ obj: { foo: ['A', 'B'] } });
    expect(parseArgsParam('obj.foo[0]:A;obj.foo[1]:B')).toStrictEqual({ obj: { foo: ['A', 'B'] } });

    expect(parseArgsParam('obj.foo[1]:B')).toStrictEqual({ obj: { foo: [, 'B'] } });
    expect(parseArgsParam('obj.foo:A;obj.foo:B')).toStrictEqual({ obj: { foo: ['A', 'B'] } });
  });

  it('parses single object in array', () => {
    const args = parseArgsParam('arr[].one:A;arr[].two:B');
    expect(args).toStrictEqual({ arr: [{ one: 'A', two: 'B' }] });
  });

  it('parses multiple objects in array', () => {
    expect(parseArgsParam('arr[0].key:A;arr[1].key:B')).toStrictEqual({
      arr: [{ key: 'A' }, { key: 'B' }],
    });
    expect(parseArgsParam('arr[0][key]:A;arr[1][key]:B')).toStrictEqual({
      arr: [{ key: 'A' }, { key: 'B' }],
    });
  });

  it('parses nested object in array', () => {
    expect(parseArgsParam('arr[].foo.bar:val')).toStrictEqual({ arr: [{ foo: { bar: 'val' } }] });
    expect(parseArgsParam('arr[][foo][bar]:val')).toStrictEqual({ arr: [{ foo: { bar: 'val' } }] });
  });

  describe('key sanitization', () => {
    it("omits keys that aren't in the extended alphanumeric set", () => {
      expect(parseArgsParam('a`b:val')).toStrictEqual({});
      expect(parseArgsParam('a~b:val')).toStrictEqual({});
      expect(parseArgsParam('a!b:val')).toStrictEqual({});
      expect(parseArgsParam('a@b:val')).toStrictEqual({});
      expect(parseArgsParam('a#b:val')).toStrictEqual({});
      expect(parseArgsParam('a$b:val')).toStrictEqual({});
      expect(parseArgsParam('a%b:val')).toStrictEqual({});
      expect(parseArgsParam('a^b:val')).toStrictEqual({});
      expect(parseArgsParam('a&b:val')).toStrictEqual({});
      expect(parseArgsParam('a*b:val')).toStrictEqual({});
      expect(parseArgsParam('a(b:val')).toStrictEqual({});
      expect(parseArgsParam('a)b:val')).toStrictEqual({});
      expect(parseArgsParam('a=b:val')).toStrictEqual({});
      expect(parseArgsParam('"b":val')).toStrictEqual({});
      expect(parseArgsParam('a/b:val')).toStrictEqual({});
      expect(parseArgsParam('a\\b:val')).toStrictEqual({});
      expect(parseArgsParam('a|b:val')).toStrictEqual({});
      expect(parseArgsParam('a[b:val')).toStrictEqual({});
      expect(parseArgsParam('a]b:val')).toStrictEqual({});
      expect(parseArgsParam('a{b:val')).toStrictEqual({});
      expect(parseArgsParam('a}b:val')).toStrictEqual({});
      expect(parseArgsParam('a?b:val')).toStrictEqual({});
      expect(parseArgsParam('a<b:val')).toStrictEqual({});
      expect(parseArgsParam('a>b:val')).toStrictEqual({});
      expect(parseArgsParam('a,b:val')).toStrictEqual({});
    });

    it('allows keys that are in the extended alphanumeric set', () => {
      expect(parseArgsParam(' key :val')).toStrictEqual({ ' key ': 'val' });
      expect(parseArgsParam('+key+:val')).toStrictEqual({ ' key ': 'val' });
      expect(parseArgsParam('-key-:val')).toStrictEqual({ '-key-': 'val' });
      expect(parseArgsParam('_key_:val')).toStrictEqual({ _key_: 'val' });
      expect(parseArgsParam('KEY123:val')).toStrictEqual({ KEY123: 'val' });
      expect(parseArgsParam('1:val')).toStrictEqual({ '1': 'val' });
    });

    it('also applies to nested object keys', () => {
      expect(parseArgsParam('obj.a!b:val')).toStrictEqual({});
      expect(parseArgsParam('obj[a!b]:val')).toStrictEqual({});
      expect(parseArgsParam('arr[][a!b]:val')).toStrictEqual({});
      expect(parseArgsParam('arr[0][a!b]:val')).toStrictEqual({});
    });

    it('completely omits an arg when a (deeply) nested key is invalid', () => {
      expect(parseArgsParam('obj.foo.a!b:val;obj.foo.bar:val;obj.baz:val')).toStrictEqual({});
      expect(parseArgsParam('obj.foo[][a!b]:val;obj.foo.bar:val;obj.baz:val')).toStrictEqual({});
      expect(parseArgsParam('obj.foo.a!b:val;key:val')).toStrictEqual({ key: 'val' });
    });
  });

  describe('value sanitization', () => {
    it("omits values that aren't in the extended alphanumeric set", () => {
      expect(parseArgsParam('key:a`b')).toStrictEqual({});
      expect(parseArgsParam('key:a~b')).toStrictEqual({});
      expect(parseArgsParam('key:a!b')).toStrictEqual({});
      expect(parseArgsParam('key:a@b')).toStrictEqual({});
      expect(parseArgsParam('key:a#b')).toStrictEqual({});
      expect(parseArgsParam('key:a$b')).toStrictEqual({});
      expect(parseArgsParam('key:a%b')).toStrictEqual({});
      expect(parseArgsParam('key:a^b')).toStrictEqual({});
      expect(parseArgsParam('key:a&b')).toStrictEqual({});
      expect(parseArgsParam('key:a*b')).toStrictEqual({});
      expect(parseArgsParam('key:a(b')).toStrictEqual({});
      expect(parseArgsParam('key:a)b')).toStrictEqual({});
      expect(parseArgsParam('key:a=b')).toStrictEqual({});
      expect(parseArgsParam('key:a[b')).toStrictEqual({});
      expect(parseArgsParam('key:a]b')).toStrictEqual({});
      expect(parseArgsParam('key:a{b')).toStrictEqual({});
      expect(parseArgsParam('key:a}b')).toStrictEqual({});
      expect(parseArgsParam('key:a\\b')).toStrictEqual({});
      expect(parseArgsParam('key:a|b')).toStrictEqual({});
      expect(parseArgsParam("key:a'b")).toStrictEqual({});
      expect(parseArgsParam('key:a"b')).toStrictEqual({});
      expect(parseArgsParam('key:a,b')).toStrictEqual({});
      expect(parseArgsParam('key:a.b')).toStrictEqual({});
      expect(parseArgsParam('key:a<b')).toStrictEqual({});
      expect(parseArgsParam('key:a>b')).toStrictEqual({});
      expect(parseArgsParam('key:a/b')).toStrictEqual({});
      expect(parseArgsParam('key:a?b')).toStrictEqual({});
    });

    it('allows values that are in the extended alphanumeric set', () => {
      expect(parseArgsParam('key: val ')).toStrictEqual({ key: ' val ' });
      expect(parseArgsParam('key:+val+')).toStrictEqual({ key: ' val ' });
      expect(parseArgsParam('key:_val_')).toStrictEqual({ key: '_val_' });
      expect(parseArgsParam('key:-val-')).toStrictEqual({ key: '-val-' });
      expect(parseArgsParam('key:VAL123')).toStrictEqual({ key: 'VAL123' });
    });

    it('allows and parses valid (fractional) numbers', () => {
      expect(parseArgsParam('key:1')).toStrictEqual({ key: 1 });
      expect(parseArgsParam('key:1.2')).toStrictEqual({ key: 1.2 });
      expect(parseArgsParam('key:-1.2')).toStrictEqual({ key: -1.2 });
      expect(parseArgsParam('key:1.')).toStrictEqual({});
      expect(parseArgsParam('key:.2')).toStrictEqual({});
      expect(parseArgsParam('key:1.2.3')).toStrictEqual({});
    });

    it('also applies to nested object and array values', () => {
      expect(parseArgsParam('obj.key:a!b')).toStrictEqual({});
      expect(parseArgsParam('obj[key]:a!b')).toStrictEqual({});
      expect(parseArgsParam('arr[][key]:a!b')).toStrictEqual({});
      expect(parseArgsParam('arr[0][key]:a!b')).toStrictEqual({});
      expect(parseArgsParam('arr[]:a!b')).toStrictEqual({});
      expect(parseArgsParam('arr[0]:a!b')).toStrictEqual({});
    });

    it('completely omits an arg when a (deeply) nested value is invalid', () => {
      expect(parseArgsParam('obj.key:a!b;obj.foo:val;obj.bar.baz:val')).toStrictEqual({});
      expect(parseArgsParam('obj.arr[]:a!b;obj.foo:val;obj.bar.baz:val')).toStrictEqual({});
      expect(parseArgsParam('obj.arr[0]:val;obj.arr[1]:a!b;obj.foo:val')).toStrictEqual({});
      expect(parseArgsParam('obj.arr[][one]:a!b;obj.arr[][two]:val')).toStrictEqual({});
      expect(parseArgsParam('arr[]:val;arr[]:a!b;key:val')).toStrictEqual({ key: 'val' });
      expect(parseArgsParam('arr[0]:val;arr[1]:a!1;key:val')).toStrictEqual({ key: 'val' });
      expect(parseArgsParam('arr[0]:val;arr[2]:a!1;key:val')).toStrictEqual({ key: 'val' });
    });
  });
});
