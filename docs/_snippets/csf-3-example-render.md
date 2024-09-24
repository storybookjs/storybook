```ts filename="CSF 3 - explicit render function" renderer="angular" language="ts"
// Other imports and story implementation
export const Default: Story = {
  render: (args) => ({
    props: args,
  }),
};
```

```js filename="CSF 3 - explicit render function" renderer="react" language="js"
// Other imports and story implementation
export const Default = {
  render: (args) => <Button {...args} />,
};
```

```ts filename="CSF 3 - explicit render function" renderer="react" language="ts"
// Other imports and story implementation
export const Default: Story = {
  render: (args) => <Button {...args} />,
};
```

```js filename="CSF 3 - explicit render function" renderer="solid" language="js"
// Other imports and story implementation
export const Default = {
  render: (args) => <Button {...args} />,
};
```

```ts filename="CSF 3 - explicit render function" renderer="solid" language="ts"
// Other imports and story implementation
export const Default: Story = {
  render: (args) => <Button {...args} />,
};
```

```js filename="CSF 3 - explicit render function" renderer="svelte" language="js"
// Other imports and story implementation
export const Default = {
  render: (args) => ({
    Component: Button,
    props: args,
  });
};
```

```ts filename="CSF 3 - explicit render function" renderer="svelte" language="ts"
// Other imports and story implementation
export const Default: Story = {
  render: (args) => ({
    Component: Button,
    props: args,
  }),
};
```

```js filename="CSF 3 - explicit render function" renderer="vue" language="js" tabTitle="3"
// Other imports and story implementation
export const Default = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
};
```

```ts filename="CSF 3 - explicit render function" renderer="vue" language="ts" tabTitle="3"
// Other imports and story implementation
export const Default: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
};
```

```js filename="CSF 3" renderer="web-components" language="js"
// Other imports and story implementation

export const Default = {
  render: (args) => html`<demo-button label="Hello" @click=${action('clicked')}></custom-button>`,
};
```

```js filename="CSF 3" renderer="web-components" language="ts"
// Other imports and story implementation

export const Default: Story = {
  render: (args) => html`<custom-button label="Hello" @click=${action('clicked')}></custom-button>`,
};
```

