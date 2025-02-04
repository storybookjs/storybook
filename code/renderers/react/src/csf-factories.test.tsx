import { expect, test, vi } from 'vitest';

import { Button } from './__test__/Button';
import { definePreview } from './preview';

test('csf factories', async () => {
  const config = definePreview({
    addons: [
      {
        decorators: [],
      },
    ],
  });

  const meta = config.meta({ component: Button, args: { primary: true } });

  const MyStory = meta.story({
    args: {
      children: 'Hello world',
    },
  });
  const spyFn = vi.fn(() => {
    console.log('bar');
  });
  MyStory.test('foo', spyFn);

  await MyStory.runTest('foo');

  expect(spyFn).toHaveBeenCalled();

  expect(MyStory.input.args?.children).toBe('Hello world');
});
