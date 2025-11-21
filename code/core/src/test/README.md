# Storybook Test

The `storybook/test` package contains utilities for testing your stories inside `play` functions.

## Usage

The test package exports instrumented versions of [@vitest/spy](https://vitest.dev/api/mock.html), [@vitest/expect](https://vitest.dev/api/expect.html) (based on [chai](https://www.chaijs.com/)), [@testing-library/dom](https://testing-library.com/docs/dom-testing-library/intro) and [@testing-library/user-event](https://testing-library.com/docs/user-event/intro).
The instrumentation makes sure you can debug those methods in the [interactions](https://storybook.js.org/addons/@storybook/addon-interactions/) panel.

```ts
// Button.stories.ts
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';

export default {
  component: Button,
  args: {
    onClick: fn(),
  },
};

export const Demo = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```
