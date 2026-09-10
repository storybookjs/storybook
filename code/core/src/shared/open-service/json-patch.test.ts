import { deepSignal } from 'deepsignal/core';
import { describe, expect, it, vi } from 'vitest';

import { applyJsonPatch } from './json-patch.ts';
import type { JsonPatchOperation } from './service-channel.ts';

const failOnUnexpectedMissingRemove = (): never => {
  throw new Error('unexpected missing remove');
};

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('applyJsonPatch', () => {
  it.each([
    {
      name: 'adds a nested object',
      op: 'add' as const,
      path: '/child',
      before: { n: 1 },
      value: { x: 1, y: [2] },
      after: { n: 1, child: { x: 1, y: [2] } },
    },
    {
      name: 'adds an array',
      op: 'add' as const,
      path: '/list',
      before: { n: 1 },
      value: [1, { k: 2 }],
      after: { n: 1, list: [1, { k: 2 }] },
    },
    {
      name: 'adds null',
      op: 'add' as const,
      path: '/n',
      before: {},
      value: null,
      after: { n: null },
    },
    {
      name: 'adds a nested key when the parent exists',
      op: 'add' as const,
      path: '/a/b',
      before: { a: { c: 1 } },
      value: [1, 2],
      after: { a: { c: 1, b: [1, 2] } },
    },
    {
      name: 'replaces an object wholesale',
      op: 'replace' as const,
      path: '/child',
      before: { child: { x: 1, y: 2 } },
      value: { x: 9 },
      after: { child: { x: 9 } },
    },
    {
      name: 'replaces an array wholesale',
      op: 'replace' as const,
      path: '/list',
      before: { list: [1, 2], keep: true },
      value: [{ k: 3 }],
      after: { list: [{ k: 3 }], keep: true },
    },
    {
      name: 'replaces an object with an array',
      op: 'replace' as const,
      path: '/child',
      before: { child: { x: 1 } },
      value: [1, 2],
      after: { child: [1, 2] },
    },
    {
      name: 'replaces an array with an object',
      op: 'replace' as const,
      path: '/child',
      before: { child: [1, 2] },
      value: { x: 1 },
      after: { child: { x: 1 } },
    },
    {
      name: 'replaces a nested primitive and keeps siblings',
      op: 'replace' as const,
      path: '/a/b',
      before: { a: { b: 1, c: 2 } },
      value: 3,
      after: { a: { b: 3, c: 2 } },
    },
    {
      name: 'upserts with add on an existing key',
      op: 'add' as const,
      path: '/n',
      before: { n: 0 },
      value: 1,
      after: { n: 1 },
    },
    {
      name: 'upserts with replace on a missing key',
      op: 'replace' as const,
      path: '/extra',
      before: { n: 0 },
      value: 3,
      after: { n: 0, extra: 3 },
    },
  ])('$name', ({ op, path, before, value, after }) => {
    const target = copy(before);
    const operation = { op, path, value } as JsonPatchOperation;

    expect(applyJsonPatch(target, [operation], failOnUnexpectedMissingRemove)).toEqual({
      ok: true,
    });
    expect(target).toEqual(after);
  });

  it('treats remove of a missing key as a no-op', () => {
    const target: Record<string, unknown> = { n: 1 };
    const onMissingRemove = vi.fn();

    expect(applyJsonPatch(target, [{ op: 'remove', path: '/missing' }], onMissingRemove)).toEqual({
      ok: true,
    });
    expect(onMissingRemove).toHaveBeenCalledWith('/missing');
    expect(target).toEqual({ n: 1 });
  });

  it('removes an existing nested key and keeps siblings', () => {
    const target: Record<string, unknown> = { a: { n: 1, m: 2 }, keep: true };

    expect(
      applyJsonPatch(target, [{ op: 'remove', path: '/a/n' }], failOnUnexpectedMissingRemove)
    ).toEqual({ ok: true });
    expect(target).toEqual({ a: { m: 2 }, keep: true });
  });

  it.each([
    {
      name: 'an object',
      value: { inner: 1 },
      mutate: (payload: unknown) => {
        (payload as { inner: number }).inner = 99;
      },
      expected: { obj: { inner: 1 } },
    },
    {
      name: 'an array of objects',
      value: [{ inner: 1 }],
      mutate: (payload: unknown) => {
        const list = payload as Array<{ inner: number }>;
        list[0].inner = 99;
        list.push({ inner: 2 });
      },
      expected: { obj: [{ inner: 1 }] },
    },
  ])(
    'clones $name so later mutation of the payload does not leak',
    ({ value, mutate, expected }) => {
      const target: Record<string, unknown> = {};

      applyJsonPatch(target, [{ op: 'add', path: '/obj', value }], failOnUnexpectedMissingRemove);
      mutate(value);

      expect(target).toEqual(expected);
    }
  );

  it('drops forbidden keys from cloned values', () => {
    const value = JSON.parse(
      '{"safe":1,"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true}}'
    ) as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    applyJsonPatch(target, [{ op: 'add', path: '/obj', value }], failOnUnexpectedMissingRemove);

    expect(target).toEqual({ obj: { safe: 1 } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops $-prefixed keys from cloned values', () => {
    const target: Record<string, unknown> = {};
    applyJsonPatch(
      target,
      [{ op: 'add', path: '/obj', value: { safe: 1, $disabled: true, $ref: '#/defs/x' } }],
      failOnUnexpectedMissingRemove
    );
    expect(target).toEqual({ obj: { safe: 1 } });
  });

  it('rolls back earlier ops when a later op has a missing parent', () => {
    const target: Record<string, unknown> = { a: { x: 1 } };

    expect(
      applyJsonPatch(
        target,
        [
          { op: 'replace', path: '/a/x', value: 2 },
          { op: 'add', path: '/list', value: [1] },
          { op: 'add', path: '/missing/y', value: 3 },
        ],
        failOnUnexpectedMissingRemove
      )
    ).toEqual({ ok: false, path: '/missing/y' });
    expect(target).toEqual({ a: { x: 1 } });
  });

  it('treats an array in the path as a missing parent', () => {
    const target: Record<string, unknown> = { list: [1, 2] };

    expect(
      applyJsonPatch(
        target,
        [{ op: 'add', path: '/list/0', value: 9 }],
        failOnUnexpectedMissingRemove
      )
    ).toEqual({ ok: false, path: '/list/0' });
    expect(target).toEqual({ list: [1, 2] });
  });

  it('refuses a forbidden key as a missing parent', () => {
    const target: Record<string, unknown> = { safe: 1 };

    expect(
      applyJsonPatch(
        target,
        [{ op: 'add', path: '/__proto__', value: { polluted: true } }],
        failOnUnexpectedMissingRemove
      )
    ).toEqual({ ok: false, path: '/__proto__' });
    expect(target).toEqual({ safe: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    { name: 'a $-prefixed key', path: '/$boom' },
    { name: 'a nested $-prefixed key', path: '/ok/$x' },
    { name: 'a malformed tilde escape', path: '/a~2b' },
    { name: 'a trailing tilde', path: '/a~' },
  ])('refuses $name as a missing parent and rolls back earlier ops', ({ path }) => {
    const target: Record<string, unknown> = { ok: 1 };

    expect(
      applyJsonPatch(
        target,
        [
          { op: 'replace', path: '/ok', value: 2 },
          { op: 'add', path, value: 1 },
        ],
        failOnUnexpectedMissingRemove
      )
    ).toEqual({ ok: false, path });
    expect(target).toEqual({ ok: 1 });
  });

  it.each([
    {
      name: 'replace of an object',
      raw: { a: { n: 1 }, b: 2 },
      ops: [
        { op: 'replace' as const, path: '/a', value: { n: 2 } },
        { op: 'add' as const, path: '/missing/y', value: 1 },
      ],
    },
    {
      name: 'replace of an array',
      raw: { a: [1, 2], b: 2 },
      ops: [
        { op: 'replace' as const, path: '/a', value: [9] },
        { op: 'add' as const, path: '/missing/y', value: 1 },
      ],
    },
    {
      name: 'remove of an object',
      raw: { a: { n: 1 }, b: 2 },
      ops: [
        { op: 'remove' as const, path: '/a' },
        { op: 'add' as const, path: '/missing/y', value: 1 },
      ],
    },
    {
      name: 'remove of an array',
      raw: { a: [1, 2], b: 2 },
      ops: [
        { op: 'remove' as const, path: '/a' },
        { op: 'add' as const, path: '/missing/y', value: 1 },
      ],
    },
  ])(
    'does not restore a deep-signal proxy into the backing store after $name rollback',
    ({ raw, ops }) => {
      const backing = copy(raw);
      const state = deepSignal(backing) as Record<string, unknown>;

      expect(
        applyJsonPatch(state, ops as JsonPatchOperation[], failOnUnexpectedMissingRemove)
      ).toEqual({ ok: false, path: '/missing/y' });
      expect(backing).toEqual(raw);
      expect(() => structuredClone(backing)).not.toThrow();
      expect(structuredClone(backing)).toEqual(raw);
    }
  );
});

describe('applyJsonPatch on a live deepsignal store', () => {
  it('replaces a payload that already has a $-prefixed argType without overflowing', () => {
    const backing: Record<string, unknown> = {
      components: {
        'button-component': {
          id: 'button-component',
          argTypes: {
            ariaLabel: { name: 'ariaLabel' },
            $disabled: true,
          },
        },
      },
    };
    const state = deepSignal(backing) as Record<string, unknown>;

    expect(
      applyJsonPatch(
        state,
        [
          {
            op: 'replace',
            path: '/components/button-component',
            value: {
              id: 'button-component',
              argTypes: {
                ariaLabel: { name: 'ariaLabel' },
                $disabled: true,
                e2eDocgenHotUpdateProp: { name: 'e2eDocgenHotUpdateProp' },
              },
            },
          },
        ],
        failOnUnexpectedMissingRemove
      )
    ).toEqual({ ok: true });

    const components = state.components as Record<string, { argTypes: Record<string, unknown> }>;
    expect(components['button-component'].argTypes.e2eDocgenHotUpdateProp).toEqual({
      name: 'e2eDocgenHotUpdateProp',
    });
  });
});
