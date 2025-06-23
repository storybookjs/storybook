# story-exports

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>recommended</li><li>flat/recommended</li><li>csf</li><li>flat/csf</li><li>csf-strict</li><li>flat/csf-strict</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

In [CSF](https://storybook.js.org/docs/writing-stories#component-story-format), a story file should contain a _default export_ that describes the component, and at _named exports_ that describe the stories. This rule enforces the definition of at least one named export in story files.

Examples of **incorrect** code for this rule:

```js
export default {
  title: 'Button',
  args: { primary: true },
  component: Button,
};
// no named export
```

Examples of **correct** code for this rule:

```js
export default {
  title: 'Button',
  args: { primary: true },
  component: Button,
};
export const Primary = {}; // at least one named export!
```

## When Not To Use It

This rule should only be applied in your `.stories.*` files. Please ensure you are defining the storybook rules only for story files. You can see more details [here](https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin#overridingdisabling-rules).

## Further Reading

More information about defining stories here: https://storybook.js.org/docs/writing-stories#defining-stories
