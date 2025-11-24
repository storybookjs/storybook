# Component property must be set in meta (csf-component)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: <ul><li>csf</li><li>flat/csf</li><li>csf-strict</li><li>flat/csf-strict</li></ul>

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule encourages you to set the `component` property of your CSF default export. The `component` property is optional, but configuring unlocks a variety of features in Storybook, including automatic prop table documentation in most frameworks, auto-generated controls for dynamically editing your stories, and in CSF3, a resonable default for rendering your component without having to define a render function.

Examples of **incorrect** code for this rule:

```js
export default {
  title: 'Button',
};
```

Examples of **correct** code for this rule:

```js
export default {
  title: 'Button',
  component: Button,
};
```

## When Not To Use It

While we encourage each CSF file to clearly correspond to a single component, it's possible to organize a Storybook in any way you choose. If you have some other organization scheme, this rule might not apply to you.

## Further Reading

- [Automatic argType inference](https://storybook.js.org/docs/api/argtypes/#automatic-argtype-inference)
