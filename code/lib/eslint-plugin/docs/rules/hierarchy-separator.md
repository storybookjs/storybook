# Deprecated hierarchy separator (hierarchy-separator)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>csf</li><li>flat/csf</li><li>recommended</li><li>flat/recommended</li><li>csf-strict</li><li>flat/csf-strict</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

Since Storybook 6.0, the ability to specify the hierarchy separators (how you control the grouping of story kinds in the sidebar) was removed. There is now a single separator `/`, which cannot be configured. If you are using `|` or `.` as a separator, you should change all of them to `/`.

Examples of **incorrect** code for this rule:

```js
export default {
  title: 'Components|Forms/Input',
  component: Input,
};
```

Examples of **correct** code for this rule:

```js
export default {
  title: 'Components/Forms/Input',
  component: Input,
};
```

## Further Reading

For more details about this change: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#removed-hierarchy-separators

To automatically migrate all of your codebase and fix this issue, run this codemod in the root folder of your project:

```sh
npx storybook@latest migrate upgrade-hierarchy-separators --glob="*/**/*.stories.@(tsx|jsx|ts|js)"
```
