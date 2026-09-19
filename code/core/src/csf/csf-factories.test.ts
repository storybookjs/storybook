//* @vitest-environment happy-dom */
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { testType } from 'type-plus';

import { getCoreAnnotations, hasCoreAnnotations } from './core-annotations.ts';
import { definePreview, definePreviewAddon, getStoryChildren } from './csf-factories.ts';
import type { Tag } from './story.ts';

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
  test('composes the core annotations exactly once and marks the result', () => {
    const previewFactory = definePreview({ renderToCanvas: () => {} });
    const { composed } = previewFactory;

    // The composed result must be flagged so that the StoryStore / portable setProjectAnnotations
    // do not prepend the core annotations a second time (which would double decorators/loaders).
    expect(hasCoreAnnotations(composed)).toBe(true);

    // The core annotations are present (the actions/test addons contribute loaders unconditionally).
    const coreLoaderCount = getCoreAnnotations().flatMap((it) => (it as any).loaders ?? []).length;
    expect(coreLoaderCount).toBeGreaterThan(0);
    expect(composed.loaders).toHaveLength(coreLoaderCount);
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
  });
});
