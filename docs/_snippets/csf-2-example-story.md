```ts filename="CSF 2 - Button.stories.ts" renderer="angular" language="ts"
// Other imports and story implementation
export const Default: Story = (args) => ({
  props: args,
});
```

```js filename="CSF 2 - Button.stories.js|jsx" renderer="react" language="js"
// Other imports and story implementation
export const Default = (args) => <Button {...args} />;
```

```ts filename="CSF 2 - Button.stories.ts|tsx" renderer="react" language="ts"
// Other imports and story implementation
export const Default: ComponentStory<typeof Button> = (args) => <Button {...args} />;
```

```js filename="CSF 2 - Button.stories.js|jsx" renderer="solid" language="js"
// Other imports and story implementation
export const Default = (args) => <Button {...args} />;
```

```ts filename="CSF 2 - Button.stories.ts|tsx" renderer="solid" language="ts"
// Other imports and story implementation
export const Default: ComponentStory<typeof Button> = (args) => <Button {...args} />;
```

```js filename="CSF 2 - Button.stories.js" renderer="svelte" language="js"
// Other imports and story implementation
export const Default = (args) => ({
  Component: Button,
  props: args,
});
```

```ts filename="CSF 2 - Button.stories.ts" renderer="svelte" language="ts"
// Other imports and story implementation
export const Default: StoryFn<typeof Button> = (args) => ({
  Component: Button,
  props: args,
});
```

```js filename="CSF 2 - Button.stories.js" renderer="vue" language="js"
// Other imports and story implementation
export const Default = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
```

```ts filename="CSF 2 - Button.stories.ts" renderer="vue" language="ts"
// Other imports and story implementation
export const Default: StoryFn<typeof Button> = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
```

```js filename="CSF 2 - Button.stories.js" renderer="web-components" language="js"
// Other imports and story implementation

export const Default = ({ primary, size, label }) =>
  html`<custom-button ?primary="${primary}" size="${size}" label="${label}"></custom-button>`;
```

```ts filename="CSF 2 - Button.stories.ts" renderer="web-components" language="ts"
// Other imports and story implementation

export const Default: Story = ({ primary, backgroundColor, size, label }) =>
  html`<custom-button ?primary="${primary}" size="${size}" label="${label}"></custom-button>`;
```
