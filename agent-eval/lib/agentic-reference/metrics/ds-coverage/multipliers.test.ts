import { describe, expect, it } from 'vitest';

import { solveMultipliers } from './multipliers.ts';

describe('solveMultipliers', () => {
  it('returns an empty map for no edges', () => {
    expect(solveMultipliers([])).toEqual(new Map());
  });

  it('gives a source with no incoming edges the floor of 1', () => {
    const solved = solveMultipliers([{ from: 'page', to: 'a', weight: 2 }]);
    expect(solved.get('page')).toBe(1);
    expect(solved.get('a')).toBe(2);
  });

  it('multiplies through a chain', () => {
    const solved = solveMultipliers([
      { from: 'page', to: 'a', weight: 2 },
      { from: 'a', to: 'b', weight: 2 },
    ]);
    expect(solved.get('b')).toBe(4);
  });

  it('sums a diamond', () => {
    const solved = solveMultipliers([
      { from: 'page', to: 'widget', weight: 1 },
      { from: 'page', to: 'shared', weight: 1 },
      { from: 'widget', to: 'shared', weight: 1 },
    ]);
    expect(solved.get('shared')).toBe(2);
  });

  it('propagates fractional weights', () => {
    const solved = solveMultipliers([
      { from: 'page', to: 'a', weight: 0.5 },
      { from: 'a', to: 'b', weight: 1 },
    ]);
    expect(solved.get('a')).toBe(0.5);
    expect(solved.get('b')).toBe(0.5);
  });

  it('counts a self-recursive component by its external usage only', () => {
    const solved = solveMultipliers([
      { from: 'page', to: 'tree', weight: 3 },
      { from: 'tree', to: 'tree', weight: 1 },
    ]);
    expect(solved.get('tree')).toBe(3);
  });

  it('shares the entering sum across a mutual-recursion cycle', () => {
    const solved = solveMultipliers([
      { from: 'page', to: 'a', weight: 2 },
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'a', weight: 1 },
    ]);
    // B renders whenever A does; the SCC shares what enters it.
    expect(solved.get('a')).toBe(2);
    expect(solved.get('b')).toBe(2);
  });

  it('floors an unreferenced cycle at 1', () => {
    const solved = solveMultipliers([
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'a', weight: 1 },
    ]);
    expect(solved.get('a')).toBe(1);
    expect(solved.get('b')).toBe(1);
  });

  it('is independent of edge order', () => {
    const edges = [
      { from: 'page', to: 'a', weight: 2 },
      { from: 'a', to: 'b', weight: 1 },
      { from: 'b', to: 'a', weight: 1 },
      { from: 'page', to: 'b', weight: 5 },
    ];
    const forward = solveMultipliers(edges);
    const backward = solveMultipliers([...edges].reverse());
    expect(backward).toEqual(forward);
    // Both members share the 7 entering the cycle: rough for the member the
    // entries skip, but deterministic, and cycles are rare.
    expect(forward.get('a')).toBe(7);
    expect(forward.get('b')).toBe(7);
  });
});
