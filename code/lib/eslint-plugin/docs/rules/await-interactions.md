# await-interactions

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>addon-interactions</li><li>flat/addon-interactions</li><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

Storybook provides an instrumented version of testing library in the [@storybook/test](https://github.com/storybookjs/storybook/tree/next/code/core/src/test) library (formerly available in [@storybook/testing-library](https://github.com/storybookjs/testing-library/) library). When [writing interactions](https://storybook.js.org/docs/essentials/interactions), make sure to **await** them, so that addon-interactions can intercept these helper functions and allow you to step through them when debugging.

Examples of **incorrect** code for this rule:

```js
import { userEvent, within } from '@storybook/test';

// or from the legacy package "@storybook/testing-library";

MyStory.play = (context) => {
  const canvas = within(context.canvasElement);
  // not awaited!
  userEvent.click(canvas.getByRole('button'));
};
```

Examples of **correct** code for this rule:

```js
import { userEvent, within } from '@storybook/test';

// or from the legacy package "@storybook/testing-library";

MyStory.play = async (context) => {
  const canvas = within(context.canvasElement);
  // awaited 👍
  await userEvent.click(canvas.getByRole('button'));
};
```

## When Not To Use It

This rule should not be applied in test files. Please ensure you are defining the storybook rules only for story files. You can see more details [here](https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin#overridingdisabling-rules).
