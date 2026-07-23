import { describe, expect, it } from 'vitest';

import { reviewServiceDef } from './review/definition.ts';

describe('OSA capability service contracts', () => {
  it('exposes the review service id', () => {
    expect(reviewServiceDef.id).toBe('core/review');
  });

  it('defines review state operations', () => {
    expect(Object.keys(reviewServiceDef.queries)).toEqual(['current']);
    expect(Object.keys(reviewServiceDef.commands)).toEqual([
      'setReview',
      'markStale',
      'dismissReview',
    ]);
  });

  it('keeps query and command names unique within each service', () => {
    for (const def of [reviewServiceDef]) {
      const names = [...Object.keys(def.queries), ...Object.keys(def.commands)];
      expect(names).toEqual([...new Set(names)]);
    }
  });
});
