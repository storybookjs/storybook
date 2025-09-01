//* @vitest-environment happy-dom */
import { describe, expect, test, vi } from 'vitest';

import { definePreview, definePreviewAddon, getStoryChildren } from './csf-factories';

interface Addon1Types {
  parameters: { foo?: { value: string } };
}

const addon = definePreviewAddon<Addon1Types>({});

interface Addon2Types {
  parameters: { bar?: { value: string } };
}

const addon2 = definePreviewAddon<Addon2Types>({});

const preview = definePreview({ addons: [addon, addon2], renderToCanvas: () => {} });

const meta = preview.meta({
  render: () => 'hello',
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
    // @ts-expect-error can not assign numbers to strings
    parameters: {
      foo: {
        value: 1,
      },
      bar: {
        value: 1,
      },
    },
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
  test('test.only adds test-only tag to story', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testName = 'should only run this test';

    MyStory.test.only(testName, () => {});
    const test = getStoryChildren(MyStory).find(({ input }) => input.name === testName)!;

    expect(test.input.tags).toEqual(expect.arrayContaining(['test-fn', 'test-only']));
  });
  test('test.skip adds test-skip tag to story', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testName = 'should skip this test';

    MyStory.test.skip(testName, () => {});
    const test = getStoryChildren(MyStory).find(({ input }) => input.name === testName)!;

    expect(test.input.tags).toEqual(expect.arrayContaining(['test-fn', 'test-skip']));
  });
});
