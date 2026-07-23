import { describe, expect, it } from 'vitest';

import { reviewServiceDef } from './review/definition.ts';
import { storiesServiceDef } from './stories/definition.ts';
import { testServiceDef } from './test/definition.ts';

describe('OSA capability service contracts', () => {
  it('exposes the three remaining service ids', () => {
    expect(storiesServiceDef.id).toBe('core/stories');
    expect(testServiceDef.id).toBe('core/test');
    expect(reviewServiceDef.id).toBe('core/review');
  });

  it('defines stories, test, and review operations as commands only', () => {
    expect(Object.keys(storiesServiceDef.queries)).toEqual([]);
    expect(Object.keys(storiesServiceDef.commands).sort()).toEqual([
      'changed',
      'findByComponent',
      'preview',
    ]);

    expect(Object.keys(testServiceDef.queries)).toEqual([]);
    expect(Object.keys(testServiceDef.commands)).toEqual(['run']);

    expect(Object.keys(reviewServiceDef.queries)).toEqual([]);
    expect(Object.keys(reviewServiceDef.commands)).toEqual(['create']);
  });

  it('keeps query and command names unique within each service', () => {
    for (const def of [storiesServiceDef, testServiceDef, reviewServiceDef]) {
      const names = [...Object.keys(def.queries), ...Object.keys(def.commands)];
      expect(names).toEqual([...new Set(names)]);
    }
  });
});
