```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF (Legacy)"
export const ShadowDOMExample: Story = {
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
};
```

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF (Legacy)"
export const ShadowDOMExample = {
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
};
```

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF"
export const ShadowDOMExample = meta.story({
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
});
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF"
export const ShadowDOMExample = meta.story({
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
});
```
