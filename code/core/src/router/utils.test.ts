import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { buildArgsParam, getMatch, parsePath } from './utils.ts';

vi.mock('storybook/internal/client-logger', () => ({
  once: { warn: vi.fn() },
  logger: { warn: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('buildArgsParam', () => {
  it('builds a simple key-value pair', () => {
    const param = buildArgsParam({}, { key: 'val' });
    expect(param).toEqual('key:val');
  });

  it('does not overflow the stack while validating a pathologically deep arg', () => {
    // validateArgs recurses through nested arrays/objects; without a depth guard a deeply nested
    // arg (e.g. a Vue VNode graph) overflows the stack. The arg is unsafe to serialize, so it's
    // simply omitted.
    const buildDeep = (depth: number) => {
      let node: any = { leaf: 1 };
      for (let i = 0; i < depth; i += 1) {
        node = { child: node };
      }
      return node;
    };

    expect(() => buildArgsParam({}, { deep: buildDeep(50_000) })).not.toThrow();
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

  describe('non-plain value diagnostics', () => {
    it('does not warn for plain serializable args', () => {
      buildArgsParam({}, { str: 'a', num: 1, nested: { arr: [1, 2] }, when: new Date(0) });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('flags a Vue reactive proxy by its reactivity flag', () => {
      const reactive = { __v_isReactive: true, label: 'hello' };
      buildArgsParam({}, { component: reactive });

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const [, suspects] = (logger.warn as Mock).mock.calls[0];
      expect(suspects).toContainEqual({ source: 'args', path: 'component', kind: 'vue-reactive' });
    });

    it('flags a React element by its $$typeof symbol', () => {
      const reactElement = { $$typeof: Symbol.for('react.element'), type: 'div', props: {} };
      buildArgsParam({}, { node: reactElement });

      const [, suspects] = (logger.warn as Mock).mock.calls[0];
      expect(suspects).toContainEqual({
        source: 'args',
        path: 'node',
        kind: 'react-element (react.element)',
      });
    });

    it('flags a class instance with a custom prototype', () => {
      class Widget {
        x = 1;
      }
      buildArgsParam({}, { widget: new Widget() });

      const [, suspects] = (logger.warn as Mock).mock.calls[0];
      expect(suspects).toContainEqual({
        source: 'args',
        path: 'widget',
        kind: 'class-instance (Widget)',
      });
    });

    it('flags a functions value', () => {
      buildArgsParam({}, { onClick: () => {} });

      const [, suspects] = (logger.warn as Mock).mock.calls[0];
      expect(suspects).toContainEqual({ source: 'args', path: 'onClick', kind: 'function' });
    });

    it('flags a circular reference reachable through plain objects', () => {
      const args: any = { a: { b: {} } };
      args.a.b.loop = args.a;
      buildArgsParam({}, args);

      const [, suspects] = (logger.warn as Mock).mock.calls[0];
      expect(suspects).toContainEqual({
        source: 'args',
        path: 'a.b.loop',
        kind: 'circular-reference',
      });
    });
  });
});
