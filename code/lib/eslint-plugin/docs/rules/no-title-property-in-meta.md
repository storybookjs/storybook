# Meta should not have a title property (no-title-property-in-meta)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>csf-strict</li><li>flat/csf-strict</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

Starting in [CSF 3.0](https://storybook.js.org/blog/component-story-format-3-0/), story titles can be generated automatically. You can still specify a title like in CSF 2.0, but if you don't specify one, it can be inferred from the story's path on disk.
This rule aims to enforce not setting a title, making the codebase consistent.

Examples of **incorrect** code for this rule:

```js
export default {
  title: 'Components/Forms/Input',
  component: Input,
};
```

Examples of **correct** code for this rule:

```js
export default {
  component: Input, // no title necessary, it will be inferred from path on disk!
};
```

## When Not To Use It

If you're not strictly enforcing this rule in your codebase (thus allowing custom titles), you should turn this rule off.

## Further Reading

You can find more information about CSF3 and story titles here: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#optional-titles
