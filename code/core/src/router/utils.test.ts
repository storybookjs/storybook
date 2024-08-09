import { describe, expect, it, vi } from 'vitest';

import { DEEPLY_EQUAL, buildArgsParam, deepDiff, getMatch, parsePath } from './utils';

vi.mock('@storybook/core/client-logger', () => ({
  once: { warn: vi.fn() },
}));

describe('getMatch', () => {
  it('gets startsWithTarget match', () => {
    const output = getMatch('/foo/bar', '/foo', true);

    expect(output).toEqual({
      path: '/foo/bar',
    });
  });

  it('gets currentIsTarget match', () => {
    const output = getMatch('/foo', '/foo', false);

    expect(output).toEqual({
      path: '/foo',
    });
  });

  it('gets matchTarget match', () => {
    const output = getMatch('/foo', '/f.+', false);

    expect(output).toEqual({
      path: '/foo',
    });
  });

  it('returns null match', () => {
    const output = getMatch('/foo/bar', '/foo/baz', true);

    expect(output).toBe(null);
  });

  it('returns null match if "startsWith" part is in the middle', () => {
    const output = getMatch('/foo/bar', '/bar', true);

    expect(output).toBe(null);
  });
});

describe('parsePath', () => {
  it('should work without path', () => {
    const output = parsePath(undefined);

    expect(output).toEqual({
      viewMode: undefined,
      storyId: undefined,
      refId: undefined,
    });
  });

  it('should parse /foo/bar correctly', () => {
    const output = parsePath('/foo/bar');

    expect(output).toMatchObject({
      viewMode: 'foo',
      storyId: 'bar',
    });
  });

  it('should parse /foo/bar/x correctly', () => {
    const output = parsePath('/foo/bar/x');

    expect(output).toMatchObject({
      viewMode: 'foo',
      storyId: 'bar',
    });
  });

  it('should parse /viewMode/refId_story--id correctly', () => {
    const output = parsePath('/viewMode/refId_story--id');

    expect(output).toMatchObject({
      viewMode: 'viewmode',
      storyId: 'story--id',
      refId: 'refid',
    });
  });
});

describe('deepDiff', () => {
  it('returns DEEPLY_EQUAL when the values are deeply equal', () => {
    expect(deepDiff({ foo: [{ bar: 1 }] }, { foo: [{ bar: 1 }] })).toBe(DEEPLY_EQUAL);
  });

  it('returns the update when the types are different', () => {
    expect(deepDiff(true, 1)).toBe(1);
  });

  it('returns a sparse array when updating an array', () => {
    expect(deepDiff([1, 2], [1, 3])).toStrictEqual([, 3]);
  });

  it('returns undefined for removed array values', () => {
    expect(deepDiff([1, 2], [1])).toStrictEqual([, undefined]);
  });

  it('returns a longer array when adding to an array', () => {
    expect(deepDiff([1, 2], [1, 2, 3])).toStrictEqual([, , 3]);
  });

  it('returns a partial when updating an object', () => {
    expect(deepDiff({ foo: 1, bar: 2 }, { foo: 1, bar: 3 })).toStrictEqual({ bar: 3 });
  });

  it('returns undefined for omitted object properties', () => {
    expect(deepDiff({ foo: 1, bar: 2 }, { foo: 1 })).toStrictEqual({ bar: undefined });
  });

  it('traverses into objects', () => {
    expect(deepDiff({ foo: { bar: [1, 2], baz: [3, 4] } }, { foo: { bar: [3] } })).toStrictEqual({
      foo: { bar: [3, undefined], baz: undefined },
    });
  });
});

describe('buildArgsParam', () => {
  it('builds a simple key-value pair', () => {
    const param = buildArgsParam({}, { key: 'val' });
    expect(param).toEqual('key:val');
  });

  it('builds multiple values', () => {
    const param = buildArgsParam({}, { one: '1', two: '2', three: '3' });
    expect(param).toEqual('one:1;two:2;three:3');
  });

  it('builds booleans', () => {
    const param = buildArgsParam({}, { yes: true, no: false });
    expect(param).toEqual('yes:!true;no:!false');
  });

  it('builds arrays', () => {
    const param = buildArgsParam({}, { arr: ['1', '2', '3'] });
    expect(param).toEqual('arr[0]:1;arr[1]:2;arr[2]:3');
  });

  it('builds sparse arrays', () => {
    const param = buildArgsParam({}, { arr: ['1', , '3'] });
    expect(param).toEqual('arr[0]:1;arr[2]:3');
  });

  it('builds simple objects', () => {
    const param = buildArgsParam({}, { obj: { one: '1', two: '2' } });
    expect(param).toEqual('obj.one:1;obj.two:2');
  });

  it('builds nested objects', () => {
    const param = buildArgsParam({}, { obj: { foo: { one: '1', two: '2' }, bar: { one: '1' } } });
    expect(param).toEqual('obj.foo.one:1;obj.foo.two:2;obj.bar.one:1');
  });

  it('builds arrays in objects', () => {
    const param = buildArgsParam({}, { obj: { foo: ['1', , '3'] } });
    expect(param).toEqual('obj.foo[0]:1;obj.foo[2]:3');
  });

  it('builds single object in array', () => {
    const param = buildArgsParam({}, { arr: [{ one: '1', two: '2' }] });
    expect(param).toEqual('arr[0].one:1;arr[0].two:2');
  });

  it('builds multiple objects in array', () => {
    const param = buildArgsParam({}, { arr: [{ one: '1' }, { two: '2' }] });
    expect(param).toEqual('arr[0].one:1;arr[1].two:2');
  });

  it('builds nested object in array', () => {
    const param = buildArgsParam({}, { arr: [{ foo: { bar: 'val' } }] });
    expect(param).toEqual('arr[0].foo.bar:val');
  });

  it('encodes space as +', () => {
    const param = buildArgsParam({}, { key: 'foo bar baz' });
    expect(param).toEqual('key:foo+bar+baz');
  });

  it('encodes null values as !null', () => {
    const param = buildArgsParam({}, { key: null });
    expect(param).toEqual('key:!null');
  });

  it('encodes nested null values as !null', () => {
    const param = buildArgsParam({}, { foo: { bar: [{ key: null }], baz: null } });
    expect(param).toEqual('foo.bar[0].key:!null;foo.baz:!null');
  });

  it('encodes hex color values as !hex(value)', () => {
    const param = buildArgsParam({}, { key: '#ff4785' });
    expect(param).toEqual('key:!hex(ff4785)');
  });

  it('encodes rgba color values by prefixing and compacting', () => {
    const param = buildArgsParam({}, { rgb: 'rgb(255, 71, 133)', rgba: 'rgba(255, 71, 133, 0.5)' });
    expect(param).toEqual('rgb:!rgb(255,71,133);rgba:!rgba(255,71,133,0.5)');
  });

  it('encodes hsla color values by prefixing and compacting', () => {
    const param = buildArgsParam({}, { hsl: 'hsl(45, 99%, 70%)', hsla: 'hsla(45, 99%, 70%, 0.5)' });
    expect(param).toEqual('hsl:!hsl(45,99,70);hsla:!hsla(45,99,70,0.5)');
  });

  it('encodes Date objects as !date(ISO string)', () => {
    const param = buildArgsParam({}, { key: new Date('2001-02-03T04:05:06.789Z') });
    expect(param).toEqual('key:!date(2001-02-03T04:05:06.789Z)');
  });

  describe('with initial state', () => {
    it('omits unchanged values', () => {
      const param = buildArgsParam({ one: 1 }, { one: 1, two: 2 });
      expect(param).toEqual('two:2');
    });

    it('omits unchanged object properties', () => {
      const param = buildArgsParam({ obj: { one: 1 } }, { obj: { one: 1, two: 2 } });
      expect(param).toEqual('obj.two:2');
    });

    it('sets !undefined for removed array values', () => {
      const param = buildArgsParam({ arr: [1] }, { arr: [] });
      expect(param).toEqual('arr[0]:!undefined');
    });

    it('sets !undefined for removed object properties', () => {
      const param = buildArgsParam({ obj: { one: 1 } }, { obj: {} });
      expect(param).toEqual('obj.one:!undefined');
    });

    it('omits unchanged array values (yielding sparse arrays)', () => {
      const param = buildArgsParam({ arr: [1, 2, 3] }, { arr: [1, 3, 4] });
      expect(param).toEqual('arr[1]:3;arr[2]:4');
    });

    it('omits nested unchanged object properties and array values', () => {
      const param = buildArgsParam(
        { obj: { nested: [{ one: 1 }, { two: 2 }] } },
        { obj: { nested: [{ one: 1 }, { two: 2, three: 3 }] } }
      );
      expect(param).toEqual('obj.nested[1].three:3');
    });
  });
});
