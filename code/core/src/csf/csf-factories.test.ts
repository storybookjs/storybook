import { expect, test, vi } from 'vitest';

import { definePreview, definePreviewAddon } from './csf-factories';

interface Addon1Types {
  parameters: { foo?: { value: string } };
}

const addon = definePreviewAddon<Addon1Types>({});

interface Addon2Types {
  parameters: { bar?: { value: string } };
}

const addon2 = definePreviewAddon<Addon2Types>({});

const preview = definePreview({ addons: [addon, addon2] });

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

test('test function is defined', async () => {
  const MyStory = meta.story({});
  const testFn = vi.fn();
  MyStory.test('should run test', testFn);
  await MyStory.__runTest('should run test');
  expect(testFn).toHaveBeenCalledWith(MyStory.composed);
});
