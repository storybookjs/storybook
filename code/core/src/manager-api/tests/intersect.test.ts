import { describe, expect, it } from 'vitest';

import intersect from '../lib/intersect';

describe('Manager API utilities - intersect', () => {
  it('returns identity when intersecting identity', () => {
    const a = ['foo', 'bar'];
    expect(intersect(a, a)).toEqual(a);
  });

  it('returns a when b is a superset of a', () => {
    const a = ['foo', 'bar'];
    const b = ['a', 'foo', 'b', 'bar', 'c', 'ter'];
    expect(intersect(a, b)).toEqual(a);
  });

  it('returns b when a is a superset of b', () => {
    const a = ['a', 'foo', 'b', 'bar', 'c', 'ter'];
    const b = ['foo', 'bar'];
    expect(intersect(a, b)).toEqual(b);
  });

  it('returns an intersection', () => {
    const a = ['a', 'bar', 'b', 'c'];
    const b = ['foo', 'bar', 'ter'];
    expect(intersect(a, b)).toEqual(['bar']);
  });

  it('returns an empty set when there is no overlap', () => {
    const a = ['a', 'b', 'c'];
    const b = ['foo', 'bar', 'ter'];
    expect(intersect(a, b)).toEqual([]);
  });

  it('returns an empty set if a is undefined', () => {
    const b = ['foo', 'bar', 'ter'];
    expect(intersect(undefined as unknown as [], b)).toEqual([]);
  });

  it('returns an empty set if b is undefined', () => {
    const a = ['foo', 'bar', 'ter'];
    expect(intersect(a, undefined as unknown as [])).toEqual([]);
  });
});
