```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
export const ShadowDOMExample = meta.story({
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
});
```

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
export const ShadowDOMExample = meta.story({
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
});
```

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export const ShadowDOMExample = {
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
};
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export const ShadowDOMExample: Story = {
  async play({ canvas }) {
    // 👇 Will find an element even if it's within a shadow root
    const button = await canvas.findByShadowRole('button', { name: /Reset/i });
  },
};
```
