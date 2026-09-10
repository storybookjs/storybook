import { deepSignal } from 'deepsignal/core';
import { describe, expect, it } from 'vitest';

import { createPatchCollector } from './patch-recorder.ts';

function record<T extends object>(initial: T, mutate: (state: T) => void) {
  const state = deepSignal(initial) as T;
  const collector = createPatchCollector();
  collector.record(state, mutate);
  return { ops: collector.flush(), state, raw: initial };
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

  it('skips $-prefixed signal keys', () => {
    const { ops, raw } = record({ n: 0 }, (state) => {
      (state as { $n?: unknown }).$n = 1;
    });

    expect(ops).toEqual([]);
    expect(raw).toEqual({ n: 0 });
  });

  it('accumulates touches across multiple record calls on one collector', () => {
    const state = deepSignal({ a: 0, b: 0 });
    const collector = createPatchCollector();
    collector.record(state, (s) => {
      s.a = 1;
    });
    collector.record(state, (s) => {
      s.b = 2;
    });

    expect(collector.flush()).toEqual([
      { op: 'replace', path: '/a', value: 1 },
      { op: 'replace', path: '/b', value: 2 },
    ]);
  });

  it('returns an empty flush when the recipe writes nothing', () => {
    const { ops } = record({ n: 0 }, () => {});

    expect(ops).toEqual([]);
  });

  it('flushes the live value when another collector restores a deleted key', () => {
    const state = deepSignal({ x: 1 } as { x?: number });
    const removed = createPatchCollector();
    const restored = createPatchCollector();
    removed.record(state, (s) => {
      delete s.x;
    });
    restored.record(state, (s) => {
      s.x = 2;
    });

    expect(restored.flush()).toEqual([{ op: 'add', path: '/x', value: 2 }]);
    expect(removed.flush()).toEqual([{ op: 'replace', path: '/x', value: 2 }]);
  });

  it('skips a remove that nets out after another collector restores the same primitive', () => {
    const state = deepSignal({ x: 1 } as { x?: number });
    const removed = createPatchCollector();
    const restored = createPatchCollector();
    removed.record(state, (s) => {
      delete s.x;
    });
    restored.record(state, (s) => {
      s.x = 1;
    });

    expect(restored.flush()).toEqual([{ op: 'add', path: '/x', value: 1 }]);
    expect(removed.flush()).toEqual([]);
  });
});
