import { effect, signal } from '@preact/signals-core';
import { deepSignal } from 'deepsignal/core';
import { describe, expect, it, vi } from 'vitest';

import { applyJsonPatch } from './json-patch.ts';
import { OpenServiceAsyncRecipeError, OpenServiceCyclicStateError } from '../../server-errors.ts';
import { type RecordedPatch, recordPatch } from './patch-recorder.ts';

function record<T extends object>(initial: T, mutate: (state: T) => void) {
  const state = deepSignal(initial) as T;
  let recorded: RecordedPatch = { ops: [], inverse: [] };
  recordPatch(state, mutate, (patch) => {
    recorded = patch;
  });
  return { ops: recorded.ops, inverse: recorded.inverse, state, raw: initial };
}

describe('patch recorder', () => {
  it('encodes ~ and / in recorded paths', () => {
    const { ops } = record({ 'a~b': 0, nested: { 'c/d': 1 } }, (state) => {
      state['a~b'] = 2;
      state.nested['c/d'] = 3;
    });

    expect(ops).toEqual([
      { op: 'replace', path: '/a~0b', value: 2 },
      { op: 'replace', path: '/nested/c~1d', value: 3 },
    ]);
  });

  it('records a replace for an existing primitive field', () => {
    const { ops } = record({ n: 0 }, (state) => {
      state.n = 1;
    });

    expect(ops).toEqual([{ op: 'replace', path: '/n', value: 1 }]);
  });

  it('records an add for a new field', () => {
    const { ops } = record({} as { n?: number }, (state) => {
      state.n = 1;
    });

    expect(ops).toEqual([{ op: 'add', path: '/n', value: 1 }]);
  });

  it('records nested writes through the proxy', () => {
    const { ops } = record({ nested: { x: 1, y: 2 } }, (state) => {
      state.nested.x = 9;
    });

    expect(ops).toEqual([{ op: 'replace', path: '/nested/x', value: 9 }]);
  });

  it('subsumes descendant paths when an ancestor is also touched', () => {
    const { ops } = record({ a: { b: { c: 1 }, d: 2 } }, (state) => {
      state.a.b.c = 3;
      state.a = { b: { c: 4 }, d: 5 };
    });

    expect(ops).toEqual([{ op: 'replace', path: '/a', value: { b: { c: 4 }, d: 5 } }]);
  });

  it('subsumes a later descendant write under an earlier ancestor write', () => {
    const { ops } = record({ a: { b: 1 } }, (state) => {
      state.a = { b: 2 };
      state.a.b = 3;
    });

    expect(ops).toEqual([{ op: 'replace', path: '/a', value: { b: 3 } }]);
  });

  it('does not treat a sibling key as an ancestor', () => {
    const { ops } = record({ a: 1, ab: 2 }, (state) => {
      state.a = 3;
      state.ab = 4;
    });

    expect(ops).toEqual([
      { op: 'replace', path: '/a', value: 3 },
      { op: 'replace', path: '/ab', value: 4 },
    ]);
  });

  it('skips a primitive that Object.is its first-touch value', () => {
    const { ops } = record({ n: 0 }, (state) => {
      state.n = 0;
    });

    expect(ops).toEqual([]);
  });

  it('skips a primitive that nets out to its first-touch value', () => {
    const { ops } = record({ n: 0 }, (state) => {
      state.n = 1;
      state.n = 0;
    });

    expect(ops).toEqual([]);
  });

  it('does not deep-compare objects that end equal to their first-touch value', () => {
    const { ops } = record({ rec: { marker: 'stable' } }, (state) => {
      state.rec = { marker: 'stable' };
    });

    expect(ops).toEqual([{ op: 'replace', path: '/rec', value: { marker: 'stable' } }]);
  });

  it('clones an assigned object so later mutation of the original does not reach state', () => {
    const original = { name: 'X' };
    const { ops, raw } = record({ y: { name: 'old' } }, (state) => {
      state.y = original;
      original.name = 'Y';
    });

    expect(raw.y).toEqual({ name: 'X' });
    expect(ops).toEqual([{ op: 'replace', path: '/y', value: { name: 'X' } }]);
    expect(ops[0]).toMatchObject({ op: 'replace' });
    if (ops[0].op !== 'replace') {
      throw new Error('expected replace');
    }
    expect(ops[0].value).not.toBe(raw.y);
  });

  it('clones the flushed payload separately from the value stored in state', () => {
    const { ops, raw } = record({ y: { name: 'X' } }, (state) => {
      state.y = { name: 'X' };
      state.y.name = 'Y';
    });

    expect(raw.y).toEqual({ name: 'Y' });
    expect(ops).toEqual([{ op: 'replace', path: '/y', value: { name: 'Y' } }]);
    if (ops[0].op !== 'replace') {
      throw new Error('expected replace');
    }
    expect(ops[0].value).not.toBe(raw.y);
  });

  it('records assigning undefined as a removal and deletes the key', () => {
    const { ops, raw } = record({ n: 1 as number | undefined }, (state) => {
      state.n = undefined;
    });

    expect(ops).toEqual([{ op: 'remove', path: '/n' }]);
    expect('n' in raw).toBe(false);
  });

  it('records delete of an existing key as a removal', () => {
    const { ops, raw } = record({ n: 1 } as { n?: number }, (state) => {
      delete state.n;
    });

    expect(ops).toEqual([{ op: 'remove', path: '/n' }]);
    expect('n' in raw).toBe(false);
  });

  it('records nothing when deleting a missing key', () => {
    const { ops } = record({} as { n?: number }, (state) => {
      delete state.n;
    });

    expect(ops).toEqual([]);
  });

  it('records nothing when assigning undefined to a missing key', () => {
    const { ops } = record({} as { n?: number }, (state) => {
      state.n = undefined;
    });

    expect(ops).toEqual([]);
  });

  it('records a whole-array replace for push, never index paths', () => {
    const { ops, raw } = record({ list: [1, 2] }, (state) => {
      state.list.push(3);
    });

    expect(ops).toEqual([{ op: 'replace', path: '/list', value: [1, 2, 3] }]);
    expect(raw.list).toEqual([1, 2, 3]);
  });

  it('records a whole-array replace for splice', () => {
    const { ops, raw } = record({ list: [1, 2, 3, 4] }, (state) => {
      state.list.splice(1, 2, 9);
    });

    expect(ops).toEqual([{ op: 'replace', path: '/list', value: [1, 9, 4] }]);
    expect(raw.list).toEqual([1, 9, 4]);
  });

  it('records a whole-array replace for index assignment and length writes', () => {
    const { ops, raw } = record({ list: [1, 2, 3] }, (state) => {
      state.list[0] = 8;
      state.list.length = 1;
    });

    expect(ops).toEqual([{ op: 'replace', path: '/list', value: [8] }]);
    expect(raw.list).toEqual([8]);
  });

  it('collapses nested writes inside array elements into the outermost array', () => {
    const { ops, raw } = record({ list: [{ name: 'a' }, { name: 'b' }] }, (state) => {
      state.list[0].name = 'A';
    });

    expect(ops).toEqual([{ op: 'replace', path: '/list', value: [{ name: 'A' }, { name: 'b' }] }]);
    expect(raw.list).toEqual([{ name: 'A' }, { name: 'b' }]);
  });

  it('collapses writes inside a nested array into the outermost array', () => {
    const { ops, raw } = record(
      {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      },
      (state) => {
        state.matrix[0].push(9);
      }
    );

    expect(ops).toEqual([
      {
        op: 'replace',
        path: '/matrix',
        value: [
          [1, 2, 9],
          [3, 4],
        ],
      },
    ]);
    expect(raw.matrix).toEqual([
      [1, 2, 9],
      [3, 4],
    ]);
  });

  it('keeps array contents intact across push then splice', () => {
    const { ops, raw } = record({ list: [1, 2] }, (state) => {
      state.list.push(3);
      state.list.splice(0, 1);
    });

    expect(raw.list).toEqual([2, 3]);
    expect(ops).toEqual([{ op: 'replace', path: '/list', value: [2, 3] }]);
  });

  it('records a new array field as an add of the whole array', () => {
    const { ops } = record({} as { list?: number[] }, (state) => {
      state.list = [1, 2];
    });

    expect(ops).toEqual([{ op: 'add', path: '/list', value: [1, 2] }]);
  });

  it('skips assigning an array element to its current primitive value', () => {
    const { ops, raw } = record({ list: [1, 2] }, (state) => {
      state.list[0] = 1;
    });

    expect(ops).toEqual([]);
    expect(raw.list).toEqual([1, 2]);
  });

  it('skips assigning length to itself', () => {
    const { ops, raw } = record({ list: [1, 2] }, (state) => {
      state.list.length = 2;
    });

    expect(ops).toEqual([]);
    expect(raw.list).toEqual([1, 2]);
  });

  it('skips pop on an empty array', () => {
    const { ops, raw } = record({ list: [] as number[] }, (state) => {
      state.list.pop();
    });

    expect(ops).toEqual([]);
    expect(raw.list).toEqual([]);
  });

  it('skips splice that inserts and deletes nothing', () => {
    const { ops, raw } = record({ list: [1, 2] }, (state) => {
      state.list.splice(0, 0);
    });

    expect(ops).toEqual([]);
    expect(raw.list).toEqual([1, 2]);
  });

  it('skips delete of a missing array index', () => {
    const { ops, raw } = record({ list: [1] }, (state) => {
      delete (state.list as (number | undefined)[])[4];
    });

    expect(ops).toEqual([]);
    expect(raw.list).toEqual([1]);
  });

  it('preserves draft identity so array lookups find the same item', () => {
    const { ops, raw } = record({ items: [{ id: 1 }, { id: 2 }] }, (state) => {
      expect(state.items[0]).toBe(state.items[0]);
      expect(state.items.includes(state.items[0])).toBe(true);
      expect(state.items.indexOf(state.items[0])).toBe(0);
      const item = state.items[0];
      state.items.splice(state.items.indexOf(item), 1);
    });

    expect(raw.items).toEqual([{ id: 2 }]);
    expect(ops).toEqual([{ op: 'replace', path: '/items', value: [{ id: 2 }] }]);
  });

  it('skips prototype-pollution keys', () => {
    const { ops, raw } = record({ safe: 0 }, (state) => {
      const payload = JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true},"safe":1}'
      ) as Record<string, unknown>;
      Object.assign(state, payload);
    });

    expect(ops).toEqual([{ op: 'replace', path: '/safe', value: 1 }]);
    expect(raw).toEqual({ safe: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not let a recipe traverse into Object.prototype', () => {
    expect(() =>
      record({ safe: 0 }, (state) => {
        (state as unknown as { __proto__: Record<string, unknown> }).__proto__.polluted = true;
      })
    ).toThrow(TypeError);
    expect(() =>
      record({ safe: 0 }, (state) => {
        (
          state as unknown as { constructor: { prototype: Record<string, unknown> } }
        ).constructor.prototype.polluted = true;
      })
    ).toThrow(TypeError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not expose a $-prefixed signal accessor to a recipe', () => {
    const { raw } = record({ n: 0 }, (state) => {
      expect((state as { $n?: unknown }).$n).toBeUndefined();
    });

    expect(raw).toEqual({ n: 0 });
  });

  it('records a $-prefixed signal swap as a write to the plain key', () => {
    const { ops, raw } = record({ n: 0 }, (state) => {
      (state as { $n?: unknown }).$n = signal(1);
    });

    expect(ops).toEqual([{ op: 'replace', path: '/n', value: 1 }]);
    expect(raw).toEqual({ n: 1 });
  });

  it('records nothing when an object is assigned to itself', () => {
    const { ops } = record({ a: { x: 1 }, list: [{ id: 1 }] }, (state) => {
      state.a = state.a;
      state.list[0] = state.list[0];
    });

    expect(ops).toEqual([]);
  });

  it('throws on an async recipe after authoring the synchronous writes', () => {
    const state = deepSignal({ a: 0 });
    const author = vi.fn();

    expect(() =>
      recordPatch(
        state,
        (async (s: { a: number }) => {
          s.a = 1;
        }) as unknown as (s: { a: number }) => void,
        author
      )
    ).toThrow(OpenServiceAsyncRecipeError);

    expect(author).toHaveBeenCalledWith({
      ops: [{ op: 'replace', path: '/a', value: 1 }],
      inverse: [{ op: 'replace', path: '/a', value: 0 }],
    });
  });

  it("throws on an async recipe nested in another, after authoring both recipes' writes once", () => {
    const state = deepSignal({ a: 0, b: 0 });
    const author = vi.fn();

    expect(() =>
      recordPatch(
        state,
        (s) => {
          s.a = 1;
          recordPatch(
            state,
            (async (inner: { b: number }) => {
              inner.b = 1;
            }) as unknown as (inner: { a: number; b: number }) => void,
            author
          );
        },
        author
      )
    ).toThrow(OpenServiceAsyncRecipeError);

    expect(author.mock.calls).toEqual([
      [
        {
          ops: [
            { op: 'replace', path: '/a', value: 1 },
            { op: 'replace', path: '/b', value: 1 },
          ],
          inverse: [
            { op: 'replace', path: '/a', value: 0 },
            { op: 'replace', path: '/b', value: 0 },
          ],
        },
      ],
    ]);
  });

  it('leaves no unhandled rejection when a nested async recipe writes after an await', async () => {
    const state = deepSignal({ a: 0, b: 0 });

    expect(() =>
      recordPatch(
        state,
        (s) => {
          s.a = 1;
          recordPatch(
            state,
            (async (inner: { b: number }) => {
              await Promise.resolve();
              inner.b = 1;
            }) as unknown as (inner: { a: number; b: number }) => void,
            () => {}
          );
        },
        () => {}
      )
    ).toThrow(OpenServiceAsyncRecipeError);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(state.b).toBe(0);
  });

  it('authors the entry before a subscriber reacts, so reaction entries come after it', () => {
    const state = deepSignal({ obj: null as { x?: number } | null });
    const author = vi.fn();
    const dispose = effect(() => {
      if (state.obj && state.obj.x === undefined) {
        recordPatch(
          state,
          (s) => {
            s.obj!.x = 1;
          },
          author
        );
      }
    });

    recordPatch(
      state,
      (s) => {
        s.obj = {};
      },
      author
    );
    dispose();

    expect(author.mock.calls.map(([recorded]) => recorded.ops)).toEqual([
      [{ op: 'replace', path: '/obj', value: {} }],
      [{ op: 'add', path: '/obj/x', value: 1 }],
    ]);
  });

  it('does not make an enclosing effect depend on the fields a recipe reads or clones', () => {
    const state = deepSignal({
      trigger: 0,
      source: { deep: 1 },
      copy: null as { deep: number } | null,
    });
    let runs = 0;
    const dispose = effect(() => {
      runs += 1;
      void state.trigger;
      recordPatch(
        state,
        (s) => {
          s.copy = s.source;
        },
        () => {}
      );
    });

    expect(runs).toBe(1);
    recordPatch(
      state,
      (s) => {
        s.source.deep = 2;
      },
      () => {}
    );
    dispose();

    expect(runs).toBe(1);
  });

  it('throws on a cyclic assigned value', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(() =>
      record({ a: null as unknown }, (state) => {
        state.a = cyclic;
      })
    ).toThrow(OpenServiceCyclicStateError);
  });

  it('copies a repeated non-cyclic object twice and drops undefined properties', () => {
    const shared = { v: 1, gone: undefined as number | undefined };
    const { ops, raw } = record({ a: null as unknown, b: null as unknown }, (state) => {
      state.a = shared;
      state.b = shared;
    });

    expect(raw.a).toEqual({ v: 1 });
    expect(raw.b).toEqual({ v: 1 });
    expect(raw.a).not.toBe(raw.b);
    expect('gone' in (raw.a as object)).toBe(false);
    expect(ops).toEqual([
      { op: 'replace', path: '/a', value: { v: 1 } },
      { op: 'replace', path: '/b', value: { v: 1 } },
    ]);
  });

  it('throws when a draft that escaped the recipe is written to', () => {
    const state = deepSignal({ a: 0 });
    let escaped: { a: number } | undefined;
    recordPatch(
      state,
      (s) => {
        escaped = s;
      },
      () => {}
    );

    expect(() => {
      escaped!.a = 1;
    }).toThrow(TypeError);
    expect(state.a).toBe(0);
  });

  it('does not call the author when the recipe writes nothing', () => {
    const author = vi.fn();
    recordPatch(deepSignal({ n: 0 }), () => {}, author);

    expect(author).not.toHaveBeenCalled();
  });

  it('copies an assigned draft so state holds no shared reference', () => {
    const { ops, raw } = record(
      {
        components: { Button: { name: 'Button', props: 3 } },
        selected: null as { name: string; props: number } | null,
      },
      (state) => {
        state.selected = state.components.Button;
      }
    );

    expect(raw.selected).toEqual({ name: 'Button', props: 3 });
    expect(raw.selected).not.toBe(raw.components.Button);
    expect(ops).toEqual([
      { op: 'replace', path: '/selected', value: { name: 'Button', props: 3 } },
    ]);
  });

  it('authors the paths written before a recipe throws, then rethrows', () => {
    const state = deepSignal({ a: 0, b: 0 });
    const author = vi.fn();

    expect(() =>
      recordPatch(
        state,
        (s) => {
          s.a = 1;
          throw new Error('boom');
        },
        author
      )
    ).toThrow('boom');

    expect(author).toHaveBeenCalledWith({
      ops: [{ op: 'replace', path: '/a', value: 1 }],
      inverse: [{ op: 'replace', path: '/a', value: 0 }],
    });
    expect(state.a).toBe(1);
  });

  it('computes inverses from first-touch values with children before parents', () => {
    const { ops, inverse } = record(
      { n: 0, child: { x: 1 } } as { n: number; child?: { x: number } },
      (s) => {
        s.n = 1;
        delete s.child;
      }
    );

    expect({ ops, inverse }).toEqual({
      ops: [
        { op: 'replace', path: '/n', value: 1 },
        { op: 'remove', path: '/child' },
      ],
      inverse: [
        { op: 'replace', path: '/n', value: 0 },
        { op: 'add', path: '/child', value: { x: 1 } },
      ],
    });
  });

  it('restores the pre-command ancestor subtree when a later ancestor delete subsumes a child delete', () => {
    const recorded = record({ a: { b: { x: 0 } } } as { a?: { b?: { x: number } } }, (s) => {
      delete s.a!.b;
      delete s.a;
    });
    expect({ ops: recorded.ops, inverse: recorded.inverse }).toEqual({
      ops: [{ op: 'remove', path: '/a' }],
      inverse: [{ op: 'add', path: '/a', value: { b: { x: 0 } } }],
    });

    const restored: Record<string, unknown> = {};
    expect(applyJsonPatch(restored, recorded.inverse, () => undefined).ok).toBe(true);
    expect(restored).toEqual({ a: { b: { x: 0 } } });
  });

  it('rebuilds a subsuming ancestor from its own descendants, not from sibling touches', () => {
    const recorded = record({ other: 0, a: { b: 1 } }, (s) => {
      s.other = 1;
      s.a.b = 2;
      s.a = { b: 3 };
    });

    expect({ ops: recorded.ops, inverse: recorded.inverse }).toEqual({
      ops: [
        { op: 'replace', path: '/other', value: 1 },
        { op: 'replace', path: '/a', value: { b: 3 } },
      ],
      inverse: [
        { op: 'replace', path: '/other', value: 0 },
        { op: 'replace', path: '/a', value: { b: 1 } },
      ],
    });
  });

  it('rebuilds an ancestor by undoing descendant touches newest first', () => {
    const recorded = record({ a: { b: { c: 0 } } } as { a?: { b?: { c: number } } }, (s) => {
      s.a!.b = { c: 1 };
      s.a!.b!.c = 2;
      delete s.a;
    });
    expect({ ops: recorded.ops, inverse: recorded.inverse }).toEqual({
      ops: [{ op: 'remove', path: '/a' }],
      inverse: [{ op: 'add', path: '/a', value: { b: { c: 0 } } }],
    });
  });

  it('does not store a forbidden key through its signal accessor', () => {
    const recorded = record({ a: 1 } as Record<string, unknown>, (s) => {
      s.$constructor = signal(5);
      s.$prototype = signal(6);
    });

    expect(recorded.ops).toEqual([]);
    expect(Object.keys(recorded.raw)).toEqual(['a']);
  });
});
