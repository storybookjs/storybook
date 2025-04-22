# Meta should be followed by `satisfies Meta` (meta-satisfies-type)

<!-- RULE-CATEGORIES:START -->

**Included in these configurations**: N/A

<!-- RULE-CATEGORIES:END -->

## Rule Details

This rule enforces writing `satisfies Meta` after the meta object definition. This is useful to ensure that stories use the correct properties in the metadata.

Additionally, `satisfies` is preferred over type annotations (`const meta: Meta = {...}`) and type assertions (`const meta = {...} as Meta`). This is because other types like `StoryObj` will check to see which properties are defined in meta and use it for increased type safety. Using type annotations or assertions hides this information from the type-checker, so satisfies should be used instead.

Examples of **incorrect** code for this rule:

```ts
export default {
  title: 'Button',
  args: { primary: true },
  component: Button,
};
```

```ts
const meta: Meta<typeof Button> = {
  title: 'Button',
  args: { primary: true },
  component: Button,
};
export default meta;
```

Examples of **correct** code for this rule:

```ts
export default {
  title: 'Button',
  args: { primary: true },
  component: Button,
} satisfies Meta<typeof Button>;
```

```ts
const meta = {
  title: 'Button',
  args: { primary: true },
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;
```

## When Not To Use It

If you aren't using TypeScript or you're using a version older than TypeScript 4.9, `satisfies` is not supported and you can avoid this rule.

## Further Reading

- [Improved type safety in Storybook 7](https://storybook.js.org/blog/improved-type-safety-in-storybook-7/?ref=storybookblog.ghost.io)
