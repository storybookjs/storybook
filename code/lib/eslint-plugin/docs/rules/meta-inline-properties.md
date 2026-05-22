# Meta should only have inline properties (meta-inline-properties)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: N/A

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule encourages you to use inline property definitions for the default export in your CSF file. The reason is that there are a bunch of tools in Storybook that rely on static analysis of your CSF code, and inline properties (rather than variables, functions, etc.) are much easier to process. Authoring your files this way may save you headaches in the future when, for example, you try to run an automated codemod to upgrade your stories to the latest version of CSF.

Examples of **incorrect** code for this rule:

```js
const title = 'Button';
const args = { primary: true };

export default {
  title,
  args,
  component: Button,
};
```

Examples of **correct** code for this rule:

```js
export default {
  title: 'Button',
  args: { primary: true },
  component: Button,
};
```
