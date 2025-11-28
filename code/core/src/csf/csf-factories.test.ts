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
});

describe('each function', () => {
  test('without overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();

    MyStory.each('test each %s', [['one'], ['two']], testFn);

    const tests = getStoryChildren(MyStory).filter(({ input }) => input.tags?.includes('test-fn'));
    expect(tests.length).toEqual(2);

    const test1 = tests.find(({ input }) => input.name === 'test each one');
    await test1?.run();
    expect(testFn).toHaveBeenLastCalledWith(expect.anything(), 'one');
    const test2 = tests.find(({ input }) => input.name === 'test each two');
    await test2?.run();
    expect(testFn).toHaveBeenLastCalledWith(expect.anything(), 'two');
  });
  test('with static overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();

    MyStory.each('test each %s', [['one'], ['two']], { args: { label: 'bar' } }, testFn);

    const tests = getStoryChildren(MyStory).filter(({ input }) => input.tags?.includes('test-fn'));
    expect(tests.length).toEqual(2);

    for (const test of tests) {
      expect(test.input.args).toEqual({ label: 'bar' });
    }
  });
  test('with dynamic overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();

    MyStory.each('test each %s', [['one'], ['two']], (num) => ({ args: { label: num } }), testFn);

    const tests = getStoryChildren(MyStory).filter(({ input }) => input.tags?.includes('test-fn'));
    expect(tests.length).toEqual(2);

    const test1 = tests.find(({ input }) => input.name === 'test each one');
    expect(test1!.input.args).toEqual({ label: 'one' });
    const test2 = tests.find(({ input }) => input.name === 'test each two');
    expect(test2!.input.args).toEqual({ label: 'two' });
  });
});

describe('matrix function', () => {
  test('without overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();

    MyStory.matrix(
      'test matrix %s %d',
      [
        ['a', 'b'],
        [1, 2],
      ],
      testFn
    );

    const tests = getStoryChildren(MyStory).filter(({ input }) => input.tags?.includes('test-fn'));
    expect(tests.length).toEqual(4);

    for (const [p1, p2] of [
      ['a', 1],
      ['a', 2],
      ['b', 1],
      ['b', 2],
    ]) {
      const test = tests.find(({ input }) => input.name === `test matrix ${p1} ${p2}`);
      expect(test).not.toBeUndefined();
      await test?.run();
      expect(testFn).toHaveBeenLastCalledWith(expect.anything(), p1, p2);
    }
  });
  test('with static overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();

    MyStory.matrix(
      'test matrix %s %d',
      [
        ['a', 'b'],
        [1, 2],
      ],
      { args: { label: 'bar' } },
      testFn
    );

    const tests = getStoryChildren(MyStory).filter(({ input }) => input.tags?.includes('test-fn'));
    expect(tests.length).toEqual(4);

    for (const test of tests) {
      expect(test.input.args).toEqual({ label: 'bar' });
    }
  });
  test('with dynamic overrides', async () => {
    const MyStory = meta.story({ args: { label: 'foo' } });
    const testFn = vi.fn();

    MyStory.matrix(
      'test matrix %s %d',
      [
        ['a', 'b'],
        [1, 2],
      ],
      (p1, p2) => ({ args: { label: `${p1} ${p2}` } }),
      testFn
    );

    const tests = getStoryChildren(MyStory).filter(({ input }) => input.tags?.includes('test-fn'));
    expect(tests.length).toEqual(4);

    for (const [p1, p2] of [
      ['a', 1],
      ['a', 2],
      ['b', 1],
      ['b', 2],
    ]) {
      const test = tests.find(({ input }) => input.name === `test matrix ${p1} ${p2}`);
      expect(test?.input.args).toEqual({ label: `${p1} ${p2}` });
    }
  });
});
