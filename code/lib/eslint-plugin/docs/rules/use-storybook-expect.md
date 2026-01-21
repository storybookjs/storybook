# Use expect from &#39;@storybook/jest&#39; (use-storybook-expect)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>addon-interactions</li><li>flat/addon-interactions</li><li>recommended</li><li>flat/recommended</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

Storybook provides a browser-compatible version of `expect` via the [storybook/test](https://github.com/storybookjs/storybook/tree/next/code/core/src/test) core package (formerly available in the legacy [@storybook/jest](https://github.com/storybookjs/jest) library).
When [writing interactions](https://storybook.js.org/docs/essentials/interactions) and asserting values, you should always use `expect` from the `storybook/test` library.

Examples of **incorrect** code for this rule:

```js
Default.play = async () => {
  // Using global expect from Jest. Will break on the browser
  await expect(123).toEqual(123);
};
```

Examples of **correct** code for this rule:

```js
// Correct import.
import { expect } from 'storybook/test';
// or this, which is now considered legacy
import { expect } from '@storybook/jest';

Default.play = async () => {
  // Using imported expect from storybook package
  await expect(123).toEqual(123);
};
```

## When Not To Use It

This rule should not be applied in test files. Please ensure that you define the Storybook rules only for story files. You can see more details [here](https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin#overridingdisabling-rules).
