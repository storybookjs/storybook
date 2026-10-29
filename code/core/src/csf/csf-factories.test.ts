//* @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
import { testType } from 'type-plus';

import * as legacyDefault from './__testfixtures__/legacy-preview-default.ts';
import * as legacyNamed from './__testfixtures__/legacy-preview-named.ts';
import { definePreview, definePreviewAddon, getStoryChildren } from './csf-factories.ts';
import type { Tag } from './story.ts';
import { setProjectAnnotations } from '../preview-api/modules/store/csf/portable-stories.ts';

interface Addon1Types {
  parameters: { foo?: { value: string } };
}

const addon = definePreviewAddon<Addon1Types>({});

interface Addon2Types {
  parameters: { bar?: { value: string } };
}

const addon2 = definePreviewAddon<Addon2Types>({});

const preview = definePreview({ addons: [addon, addon2], renderToCanvas: () => {} });

const meta = preview.type<{ args: { label: string } }>().meta({
  args: { label: 'foo' },
  render: ({ label }) => 'hello' + label,
});

test('addon parameters are inferred', () => {
  const MyStory = meta.story({
    parameters: {
      foo: {
        value: '1',
      },
      bar: {
        value: '1',
      },
    },
  });
  const MyStory2 = meta.story({
    parameters: {
      foo: {
        // @ts-expect-error can not assign numbers to strings
        value: 1,
      },
      bar: {
        // @ts-expect-error can not assign numbers to strings
        value: 1,
      },
    },
  });
});

describe('legacy preview annotation namespaces', () => {
  test('keep factory addon types when mixed with factory addons', () => {
    const mixedPreview = definePreview({
      addons: [legacyDefault, legacyNamed, addon],
      renderToCanvas: () => {},
    });
    const mixedMeta = mixedPreview.meta({ parameters: { foo: { value: 'typed' } } });

    mixedMeta.story({
      parameters: {
        foo: {
          // @ts-expect-error factory addon parameter types remain enforced
          value: 1,
        },
      },
    });

    expect(mixedPreview.composed.parameters).toMatchObject({
      legacyDefault: true,
      legacyNamed: true,
    });
  });

  test('do not collapse preview types when used without factory addons', () => {
    const legacyPreview = definePreview({
      addons: [legacyDefault],
      renderToCanvas: () => {},
    });

    legacyPreview.meta({ parameters: { layout: 'centered' } });
  });

  test('uncalled addon factories are rejected', () => {
    definePreview({
      // @ts-expect-error the factory must be called
      addons: [() => addon],
      renderToCanvas: () => {},
    });
  });
});

interface GlobalsAddonTypes {
  globals: { theme: 'light' | 'dark'; locale: 'en' | 'fr' };
}

const globalsAddon = definePreviewAddon<GlobalsAddonTypes>({});
const globalsPreview = definePreview({ addons: [globalsAddon], renderToCanvas: () => {} });
const globalsMeta = globalsPreview.type<{ args: { label: string } }>().meta({
  args: { label: 'foo' },
  render: ({ label }) => 'hello' + label,
});

test('globals overrides may be partial, mirroring args', () => {
  // A story may override a subset of the typed globals (here `theme` without `locale`).
  globalsMeta.story({ globals: { theme: 'dark' } });

  // The same applies to component-level (meta) overrides.
  globalsPreview.type<{ args: { label: string } }>().meta({
    args: { label: 'foo' },
    render: ({ label }) => 'hello' + label,
    globals: { locale: 'fr' },
  });

  // Only the keys become optional — values stay type-checked.
  globalsPreview.type<{ args: { label: string } }>().meta({
    args: { label: 'foo' },
    render: ({ label }) => 'hello' + label,
    // @ts-expect-error theme must be 'light' | 'dark'
    globals: { theme: 'blue' },
  });
});

describe('meta.type<>()', () => {
  test('returns the meta itself', () => {
    expect(meta.type<{ args: { count: number } }>()).toBe(meta);
  });

  test('adds types to the stories created from it', () => {
    const typed = meta.type<{
      args: { count: number };
      parameters: { baz?: { value: string } };
      globals: { tone: 'warm' | 'cool' };
      tags: Array<'a' | 'b'>;
    }>();

    const MyStory = typed.story({
      args: { count: 1 },
      parameters: { foo: { value: '1' }, baz: { value: '1' } },
      globals: { tone: 'warm' },
      tags: ['a'],
      render: ({ label, count }) => {
        expectTypeOf(label).toEqualTypeOf<string>();
        expectTypeOf(count).toEqualTypeOf<number>();
        return label + count;
      },
    });
    expect(MyStory.composed.args).toEqual({ label: 'foo', count: 1 });

    // @ts-expect-error count is required
    typed.story({ args: { label: 'bar' } });
    // @ts-expect-error can not assign numbers to strings
    typed.story({ args: { count: 1 }, parameters: { baz: { value: 1 } } });
    // @ts-expect-error tone must be 'warm' | 'cool'
    typed.story({ args: { count: 1 }, globals: { tone: 'hot' } });
    // @ts-expect-error tags must be 'a' | 'b'
    typed.story({ args: { count: 1 }, tags: ['c'] });
  });

  test('an arg of the meta that is redeclared must be set again', () => {
    // @ts-expect-error label is required, the meta sets it to 'foo'
    meta.type<{ args: { label: 'bar' } }>().story({ args: {} });
    meta.type<{ args: { label: 'bar' } }>().story({ args: { label: 'bar' } });
  });
});

describe('test function', () => {
  test('without overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn(() => console.log('testFn'));
    const testName = 'should run test';

    // register test
    MyStory.test(testName, testFn);
    const test = getStoryChildren(MyStory).find(({ input }) => input.name === testName)!;
    expect(test.input.args).toEqual({ label: 'foo' });

    // execute test
    await test.run(undefined, testName);
    expect(testFn).toHaveBeenCalled();
  });
  test('with overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();
    const testName = 'should run test';

    // register test
    MyStory.test(testName, { args: { label: 'bar' } }, testFn);
    const test = getStoryChildren(MyStory).find(({ input }) => input.name === testName)!;
    expect(test.input.args).toEqual({ label: 'bar' });

    // execute test
    await test.run();
    expect(testFn).toHaveBeenCalled();
  });
});

describe('definePreview composed', () => {
  beforeEach(() => {
    vi.stubGlobal('globalProjectAnnotations', undefined);
    vi.stubGlobal('__STORYBOOK_SET_PROJECT_ANNOTATIONS_CALLED__', false);
    vi.stubGlobal('__STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__', false);
  });
  afterEach(() => vi.unstubAllGlobals());

  test('composes only the preview and its addons until collected entries arrive', () => {
    const { composed } = definePreview({ renderToCanvas: () => {} });

    expect(composed.loaders).toEqual([]);
  });

  test('composes the defaults before the addons until a host composes its own entries', () => {
    const defaults = { loaders: [vi.fn()] };
    const addon = { loaders: [vi.fn()] };
    const preview = definePreview({ addons: [addon] }, [defaults]);

    expect(preview.composed.loaders).toEqual([...defaults.loaders, ...addon.loaders]);
    expect(preview.composeWith([]).loaders).toEqual(addon.loaders);
  });

  test('composes collected entries, local addons, and preview annotations in order', () => {
    const entries = ['renderer', 'first addon', 'second addon', 'legacy', 'local', 'preview'].map(
      (name) => ({
        loaders: [vi.fn()],
        decorators: [vi.fn()],
        parameters: { winner: name },
      })
    );
    const preview = definePreview({ addons: [entries[4]], ...entries[5] });
    const composed = preview.composeWith(entries.slice(0, 4));

    expect(composed.loaders).toEqual(entries.flatMap((entry) => entry.loaders));
    expect(composed.decorators).toEqual(entries.toReversed().flatMap((entry) => entry.decorators));
    expect(composed.parameters).toMatchObject({ winner: 'preview' });
    expect(preview.composed).toBe(composed);
    expect(setProjectAnnotations([composed]).loaders).toEqual(composed.loaders);
  });

  test.each(['namespace', 'default export'])(
    'deduplicates a collected %s and a local addon by annotation identity',
    (kind) => {
      const decorator = vi.fn();
      const annotations = definePreviewAddon({ decorators: [decorator] });
      const collected = kind === 'namespace' ? annotations : { default: annotations };
      const preview = definePreview({ addons: [annotations, collected] });

      const composed = preview.composeWith([collected, collected]);

      expect(composed.decorators?.filter((entry) => entry === decorator)).toHaveLength(1);
    }
  );

  test('keeps distinct annotation objects even when they share a decorator', () => {
    const decorator = vi.fn();
    const preview = definePreview({ addons: [{ decorators: [decorator] }] });
    const composed = preview.composeWith([{ decorators: [decorator] }]);
    expect(composed.decorators?.filter((entry) => entry === decorator)).toHaveLength(2);
  });

  test('refreshes the cache for addon edits and removal, including live module exports', () => {
    const original = vi.fn();
    const updated = vi.fn();
    const collected = { decorators: [original] };
    const preview = definePreview({});
    const first = preview.composeWith([collected]);

    collected.decorators = [updated];
    const second = preview.composeWith([collected]);
    expect(second).not.toBe(first);
    expect(preview.composed).toBe(second);
    expect(second.decorators).toContain(updated);
    expect(second.decorators).not.toContain(original);
    expect(preview.composeWith([]).decorators).not.toContain(updated);
  });

  test('keeps composition lazy and allows portable annotations to replace the global', () => {
    const readParameters = vi.fn(() => ({ lazy: true }));
    const preview = definePreview({
      get parameters() {
        return readParameters();
      },
    });
    expect(readParameters).not.toHaveBeenCalled();

    const composed = preview.composeWith([{ parameters: { collected: true } }]);
    expect(globalThis.globalProjectAnnotations).toBe(composed);
    expect(composed.parameters).toMatchObject({ collected: true, lazy: true });
    expect(preview.composed).toBe(composed);
    expect(readParameters).toHaveBeenCalledOnce();

    const portable = setProjectAnnotations(composed);
    expect(globalThis.globalProjectAnnotations).toBe(portable);
    expect(portable.loaders).toEqual(composed.loaders);
  });
});

describe('customize tags type', () => {
  // Customizing tags type enables autocompletion of tags.
  test('with addon', () => {
    const addon = definePreviewAddon<{ tags: Array<'foo' | 'bar' | (string & {})> }>({});
    const preview = definePreview({ addons: [addon] });
    const meta = preview.meta({
      tags: ['foo', 'something-else'],
    });
    meta.story({
      tags: ['foo', 'something-else'],
    });
    testType.canAssign<
      Parameters<typeof preview.meta>[0]['tags'],
      Array<'foo' | 'bar' | (string & {})>
    >(true);
    testType.canAssign<
      Parameters<typeof meta.story>[0] extends object
        ? Parameters<typeof meta.story>[0]['tags']
        : never,
      Array<'foo' | 'bar' | (string & {})>
    >(true);
    testType.canAssign<
      Parameters<typeof meta.story>[0] extends object
        ? Parameters<typeof meta.story>[0]['tags']
        : never,
      Tag[]
    >(true);
    expectTypeOf<NonNullable<Parameters<typeof meta.story>[0]>['tags']>().toEqualTypeOf<
      Array<'foo' | 'bar' | (string & {})> | undefined
    >();
  });
  test('with type method', () => {
    const preview = definePreview({ addons: [] }).type<{
      tags: Array<'foo' | 'bar' | (string & {})>;
    }>();
    const meta = preview.meta({
      tags: ['foo', 'something-else'],
    });
    meta.story({
      tags: ['foo', 'something-else'],
    });
    testType.canAssign<
      Parameters<typeof preview.meta>[0]['tags'],
      Array<'foo' | 'bar' | (string & {})>
    >(true);
    testType.canAssign<
      Parameters<typeof meta.story>[0] extends object
        ? Parameters<typeof meta.story>[0]['tags']
        : never,
      Array<'foo' | 'bar' | (string & {})>
    >(true);
    testType.canAssign<
      Parameters<typeof meta.story>[0] extends object
        ? Parameters<typeof meta.story>[0]['tags']
        : never,
      Tag[]
    >(true);
    expectTypeOf<NonNullable<Parameters<typeof meta.story>[0]>['tags']>().toEqualTypeOf<
      Array<'foo' | 'bar' | (string & {})> | undefined
    >();
  });
  test('with strict tags', () => {
    const preview = definePreview({ addons: [] }).type<{ tags: Array<'foo' | 'bar'> }>();
    const meta = preview.meta({});
    meta.story({ tags: ['foo', 'bar'] });
    meta.story({
      // @ts-expect-error 'baz' is not one of the declared tags
      tags: ['baz'],
    });
  });
});
