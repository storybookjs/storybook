import { describe, expect, it } from 'vitest';

import { combineParameters } from './parameters';

describe('client-api.parameters', () => {
  it('merges different sets of parameters by key, preferencing last', () => {
    expect(combineParameters({ a: 'b', c: 'd' }, { e: 'f', a: 'g' })).toEqual({
      a: 'g',
      c: 'd',
      e: 'f',
    });
  });

  it('merges sub-keys', () => {
    expect(combineParameters({ ns: { a: 'b', c: 'd' } }, { ns: { e: 'f', a: 'g' } })).toEqual({
      ns: {
        a: 'g',
        c: 'd',
        e: 'f',
      },
    });
  });

  it('treats array values as scalars', () => {
    expect(combineParameters({ ns: { array: [1, 2, 3] } }, { ns: { array: [3, 4, 5] } })).toEqual({
      ns: {
        array: [3, 4, 5],
      },
    });
  });

  it('ignores undefined additions', () => {
    expect(combineParameters({ a: 1 }, { a: 2 }, { a: undefined })).toEqual({ a: 2 });
  });
});
