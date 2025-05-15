```ts filename="Button.stories.ts" renderer="common" language="ts"
// ...rest of story file

export const ExampleStory: Story = {
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="common" language="js"
// ...rest of story file

export const ExampleStory = {
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {
        include: ['body'],
        exclude: ['.no-a11y-check'],
      },
    },
  },
};
```
