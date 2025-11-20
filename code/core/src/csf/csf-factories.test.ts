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

describe('play exposure and fallback', () => {
  test('meta.play is callable when defined on meta', async () => {
    const p = vi.fn(async () => {});
    const metaWithPlay = preview.meta({ play: p, render: () => null });
    expect(typeof metaWithPlay.play).toBe('function');
    await metaWithPlay.play({} as any);
    expect(p).toHaveBeenCalled();
  });

  test("story.play falls back to meta's play when story has none", async () => {
    const p = vi.fn(async () => {});
    const metaWithPlay = preview.meta({ play: p, render: () => null });
    const Story = metaWithPlay.story({});
    expect(typeof Story.play).toBe('function');
    await Story.play({} as any);
    expect(p).toHaveBeenCalled();
  });

  test('story.composed.play exists when meta defines play', async () => {
    const p = vi.fn(async () => {});
    const metaWithPlay = preview.meta({ play: p, render: () => null });
    const Story = metaWithPlay.story({});
    // composed.play should exist and be callable
    expect(typeof (Story.composed as any).play).toBe('function');
  });
});
