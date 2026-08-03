import { describe, expect, it } from 'vitest';

import {
  getCoreAnnotations,
  hasCoreAnnotations,
  markAsComposedWithCoreAnnotations,
} from './core-annotations.ts';

describe('core annotations marker', () => {
  it('marks an object as composed with core annotations', () => {
    const annotations = { decorators: [] };
    expect(hasCoreAnnotations(annotations)).toBe(false);

    const marked = markAsComposedWithCoreAnnotations(annotations);
    expect(marked).toBe(annotations);
    expect(hasCoreAnnotations(annotations)).toBe(true);
  });

  it('uses a non-enumerable marker so it is not copied by object spread', () => {
    const marked = markAsComposedWithCoreAnnotations({ decorators: [] });

    // The marker must not leak into composed configs / spreads
    expect(Object.keys(marked)).toEqual(['decorators']);
    expect(hasCoreAnnotations({ ...marked })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(hasCoreAnnotations(undefined)).toBe(false);
    expect(hasCoreAnnotations(null)).toBe(false);
    expect(hasCoreAnnotations('preview')).toBe(false);
    expect(hasCoreAnnotations(42)).toBe(false);
  });

  it('exposes the core annotations as an array', () => {
    const core = getCoreAnnotations();
    expect(Array.isArray(core)).toBe(true);
    expect(core.length).toBeGreaterThan(0);
  });
});
