```ts filename="CSF 2" renderer="angular" language="ts"
// Other imports and story implementation
export const Default: Story = (args) => ({
  props: args,
});
```

```js filename="CSF 2" renderer="react" language="js"
// Other imports and story implementation
export const Default = (args) => <Button {...args} />;
```

```ts filename="CSF 2" renderer="react" language="ts"
// Other imports and story implementation
export const Default: ComponentStory<typeof Button> = (args) => <Button {...args} />;
```

```js filename="CSF 2" renderer="solid" language="js"
// Other imports and story implementation
export const Default = (args) => <Button {...args} />;
```

```ts filename="CSF 2" renderer="solid" language="ts"
// Other imports and story implementation
export const Default: ComponentStory<typeof Button> = (args) => <Button {...args} />;
```

```js filename="CSF 2" renderer="svelte" language="js"
// Other imports and story implementation
export const Default = (args) => ({
  Component: Button,
  props: args,
});
```

```ts filename="CSF 2" renderer="svelte" language="ts"
// Other imports and story implementation
export const Primary: StoryFn<typeof Button> = (args) => ({
  Component: Button,
  props: args,
});
```

```js filename="CSF 2" renderer="vue" language="js" tabTitle="3"
// Other imports and story implementation
export const Default = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
```

```ts filename="CSF 2" renderer="vue" language="ts" tabTitle="3"
// Other imports and story implementation
export const Default: StoryFn<typeof Button> = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
```

```js filename="CSF 2" renderer="web-components" language="js"
// Other imports and story implementation

export const Default = ({ primary, backgroundColor, size, label }) =>
  html`<custom-button ?primary="${primary}" size="${size}" label="${label}"></custom-button>`;
```

```ts filename="CSF 2" renderer="web-components" language="ts"
// Other imports and story implementation

export const Default: Story = ({ primary, backgroundColor, size, label }) =>
  html`<custom-button ?primary="${primary}" size="${size}" label="${label}"></custom-button>`;
```

