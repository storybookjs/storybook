//* @vitest-environment happy-dom */
import { describe, expect, test, vi } from 'vitest';

import { definePreview, definePreviewAddon, getStoryChildren } from './csf-factories.ts';

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

test('addon parameters and globals are inferred in decorator context', () => {
  const typedMeta = preview.type<{ globals: { theme: 'light' | 'dark' } }>().meta({
    decorators: [
      (Story, { parameters, globals }) => {
        parameters.foo?.value satisfies string | undefined;
        parameters.bar?.value satisfies string | undefined;
        globals.theme satisfies 'light' | 'dark';

        // @ts-expect-error can not treat string parameter values as numbers
        parameters.foo!.value satisfies number;
        // @ts-expect-error can not treat typed globals as other values
        globals.theme satisfies 'sepia';

        return Story();
      },
    ],
  });

  typedMeta.story();
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
