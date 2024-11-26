```js filename="CSF 3 - Button.stories.js|jsx" renderer="common" language="js"
export const PrimaryOnDark = {
  ...Primary,
  parameters: { background: { default: 'dark' } },
};
```

```ts filename="CSF 3 - Button.stories.ts|tsx" renderer="common" language="ts"
export const PrimaryOnDark: Story = {
  ...Primary,
  parameters: { background: { default: 'dark' } },
};
```
