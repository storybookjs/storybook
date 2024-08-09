import { describe, expect, it } from 'vitest';

import type { StoryId, StoryIndexEntry } from '@storybook/core/types';

import { storySort } from './storySort';

describe('preview.storySort', () => {
  const fixture: Record<StoryId, StoryIndexEntry> = Object.fromEntries(
    Object.entries({
      a: { title: 'a' },
      á: { title: 'á' },
      A: { title: 'A' },
      b: { title: 'b' },
      a_a: { title: 'a / a' },
      a_b: { title: 'a / b' },
      a_c: { title: 'a / c' },
      b_a_a: { title: 'b / a / a' },
      b_b: { title: 'b / b' },
      c: { title: 'c' },
      locale1: { title: 'Б' },
      locale2: { title: 'Г' },
      c__a: { title: 'c', name: 'a' },
      c_b__a: { title: 'c / b', name: 'a' },
      c_b__b: { title: 'c / b', name: 'b' },
      c_b__c: { title: 'c / b', name: 'c' },
      c__c: { title: 'c', name: 'c' },
    }).map(([id, entry]) => [id, { type: 'story', name: 'name', ...entry, id, importPath: id }])
  );

  it('uses configure order by default', () => {
    const sortFn = storySort();

    expect(sortFn(fixture.a, fixture.b)).toBe(0);
    expect(sortFn(fixture.b, fixture.a)).toBe(0);
    expect(sortFn(fixture.a, fixture.a)).toBe(0);
  });

  it('can sort shallow titles alphabetically', () => {
    const sortFn = storySort({ method: 'alphabetical' });

    expect(sortFn(fixture.a, fixture.b)).toBeLessThan(0);
    expect(sortFn(fixture.b, fixture.a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a, fixture.á)).toBeLessThan(0);
    expect(sortFn(fixture.á, fixture.a)).toBeGreaterThan(0);
  });

  it('can sort deep titles alphabetically', () => {
    const sortFn = storySort({ method: 'alphabetical' });

    expect(sortFn(fixture.a_a, fixture.a_b)).toBeLessThan(0);
    expect(sortFn(fixture.a_b, fixture.a_a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_a, fixture.b)).toBeLessThan(0);
    expect(sortFn(fixture.b, fixture.a_a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_a, fixture.a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a, fixture.a_a)).toBeLessThan(0);
    expect(sortFn(fixture.b_a_a, fixture.b_b)).toBeLessThan(0);
    expect(sortFn(fixture.b_b, fixture.b_a_a)).toBeGreaterThan(0);
  });

  it('ignores case when sorting alphabetically', () => {
    const sortFn = storySort({ method: 'alphabetical' });

    expect(sortFn(fixture.a, fixture.A)).toBe(0);
    expect(sortFn(fixture.A, fixture.a)).toBe(0);
  });

  it('sorts alphabetically using the given locales', () => {
    const sortFn = storySort({ method: 'alphabetical', locales: 'ru-RU' });

    expect(sortFn(fixture.locale1, fixture.locale2)).toBeLessThan(0);
    expect(sortFn(fixture.locale2, fixture.locale1)).toBeGreaterThan(0);
  });

  it('sorts according to the order array', () => {
    const sortFn = storySort({ order: ['b', 'c'] });

    expect(sortFn(fixture.a, fixture.b)).toBeGreaterThan(0);
    expect(sortFn(fixture.b, fixture.a)).toBeLessThan(0);
    expect(sortFn(fixture.b_a_a, fixture.b_b)).toBe(0);
    expect(sortFn(fixture.b_b, fixture.b_a_a)).toBe(0);
  });

  it('sorts according to the nested order array', () => {
    const sortFn = storySort({ order: ['a', ['b', 'c'], 'c'] });

    expect(sortFn(fixture.a_a, fixture.a_b)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_b, fixture.a_a)).toBeLessThan(0);
  });

  it('sorts alphabetically including story names', () => {
    const sortFn = storySort({ method: 'alphabetical', includeNames: true });
    expect(sortFn(fixture.c_b__a, fixture.c__a)).toBeGreaterThan(0);
    expect(sortFn(fixture.c__a, fixture.c_b__a)).toBeLessThan(0);

    expect(sortFn(fixture.c__c, fixture.c__a)).toBeGreaterThan(0);
    expect(sortFn(fixture.c__a, fixture.c__c)).toBeLessThan(0);
  });

  it('sorts according to the order array including story names', () => {
    const sortFn = storySort({
      order: ['c', ['b', ['c', 'b', 'a'], 'c', 'a']],
      includeNames: true,
    });
    expect(sortFn(fixture.c_b__a, fixture.c_b__b)).toBeGreaterThan(0);
    expect(sortFn(fixture.c_b__b, fixture.c_b__c)).toBeGreaterThan(0);
    expect(sortFn(fixture.c_b__a, fixture.c_b__c)).toBeGreaterThan(0);
    expect(sortFn(fixture.c_b__a, fixture.c__a)).toBeLessThan(0);
    expect(sortFn(fixture.c_b__a, fixture.c__c)).toBeLessThan(0);
    expect(sortFn(fixture.c__a, fixture.c__c)).toBeGreaterThan(0);
  });

  it('sorts according to the order array with a wildcard', () => {
    const sortFn = storySort({ order: ['a', '*', 'b'] });

    expect(sortFn(fixture.a, fixture.b)).toBeLessThan(0);
    expect(sortFn(fixture.c, fixture.b)).toBeLessThan(0);
    expect(sortFn(fixture.b, fixture.c)).toBeGreaterThan(0);
    expect(sortFn(fixture.b, fixture.a)).toBeGreaterThan(0);
  });

  it('sorts according to the nested order array with wildcard', () => {
    const sortFn = storySort({ order: ['a', ['a', '*', 'b'], 'c'] });

    expect(sortFn(fixture.a, fixture.c)).toBeLessThan(0);
    expect(sortFn(fixture.c, fixture.a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_a, fixture.a_b)).toBeLessThan(0);
    expect(sortFn(fixture.a_b, fixture.a_a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_a, fixture.a_c)).toBeLessThan(0);
    expect(sortFn(fixture.a_c, fixture.a_a)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_c, fixture.a_b)).toBeLessThan(0);
    expect(sortFn(fixture.a_b, fixture.a_c)).toBeGreaterThan(0);
  });

  it('sorts according to the nested order array with parent wildcard', () => {
    const sortFn = storySort({
      order: ['*', ['*', 'b', 'a']],
      includeNames: true,
    });

    expect(sortFn(fixture.a_a, fixture.a_b)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_b, fixture.a_a)).toBeLessThan(0);
    expect(sortFn(fixture.a_c, fixture.a_a)).toBeLessThan(0);
    expect(sortFn(fixture.a_c, fixture.a_b)).toBeLessThan(0);
    expect(sortFn(fixture.a_a, fixture.a_c)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_b, fixture.a_c)).toBeGreaterThan(0);
    expect(sortFn(fixture.a_a, fixture.a_a)).toBe(0);
  });

  it('uses weighted sorting when one or both names have a weight', () => {
    const sortFn = storySort({ order: ['a', 'b'], weights: { a: 1, b: -1 } });

    expect(sortFn(fixture.a, fixture.b)).toBeGreaterThan(0);
    expect(sortFn(fixture.a, fixture.c)).toBeGreaterThan(0);
    expect(sortFn(fixture.b, fixture.a)).toBeLessThan(0);
    expect(sortFn(fixture.b, fixture.c)).toBeLessThan(0);
    expect(sortFn(fixture.c, fixture.a)).toBeLessThan(0);
    expect(sortFn(fixture.c, fixture.b)).toBeGreaterThan(0);
  });
});
