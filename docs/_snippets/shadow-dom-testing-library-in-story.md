```ts filename="Example.stories.ts" renderer="web-components" language="ts"
export const ShadowDOMExample: Story = {
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
};
```

```js filename="Example.stories.js" renderer="web-components" language="js"
export const ShadowDOMExample = {
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
};
```
