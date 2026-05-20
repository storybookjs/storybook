# Use storybook testing library package (use-storybook-testing-library)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>addon-interactions</li><li>flat/addon-interactions</li><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

Storybook provides an instrumented version of the testing library in the [storybook/test](https://github.com/storybookjs/storybook/tree/next/code/core/src/test) core package (formerly available in [@storybook/testing-library](https://github.com/storybookjs/testing-library/) library).
When [writing interactions](https://storybook.js.org/docs/essentials/interactions), make sure to use the helper functions from `storybook/test`, so that addon-interactions can intercept these helper functions and allow you to step through them when debugging.

Examples of **incorrect** code for this rule:

```js
// wrong import!
import { within } from '@testing-library/react';

Default.play = async (context) => {
  const canvas = within(context.canvasElement);
};
```

Examples of **correct** code for this rule:

```js
// correct import.
import { within } from 'storybook/test';
// or this, which is now considered legacy
import { within } from '@storybook/testing-library';

Default.play = async (context) => {
  const canvas = within(context.canvasElement);
};
```

## When Not To Use It

This rule should not be applied in test files. Please ensure that you define the Storybook rules only for story files. You can see more details [here](https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin#overridingdisabling-rules).
