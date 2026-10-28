import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getCoreAnnotations,
  hasCoreAnnotations,
  markAsComposedWithCoreAnnotations,
} from './annotations.ts';
import { builtInAddons } from './index.ts';

afterEach(() => vi.restoreAllMocks());

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

describe('built-in addons', () => {
  it.each(builtInAddons.map((addon) => [addon.meta.name, addon] as const))(
    '%s declares an addon contribution',
    (_name, addon) => {
      expect(addon.meta.name).toMatch(/^storybook\//);
      expect(addon.meta.kind).toBe('addon');
      expect(addon.setup).toEqual(expect.any(Function));
      if (addon.manager) {
        expect(addon.meta.order).toEqual(expect.any(Number));
      }
    }
  );

  it('creates the core preview annotations in registration order', () => {
    expect(getCoreAnnotations().map((annotations) => Object.keys(annotations).sort()))
      .toMatchInlineSnapshot(`
      [
        [
          "decorators",
          "initialGlobals",
        ],
        [
          "decorators",
          "initialGlobals",
          "parameters",
        ],
        [],
        [
          "decorators",
          "initialGlobals",
        ],
        [
          "initialGlobals",
        ],
        [
          "argsEnhancers",
          "loaders",
        ],
        [
          "parameters",
          "runStep",
        ],
        [
          "loaders",
        ],
        [
          "afterEach",
        ],
        [
          "beforeAll",
        ],
        [],
      ]
    `);
  });

  it('keeps the preview runtime out of the plugins', () => {
    expect(builtInAddons.filter((addon) => 'preview' in addon)).toEqual([]);
  });
});
