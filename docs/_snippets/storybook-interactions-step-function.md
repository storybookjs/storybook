```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
// ...rest of story file

export const Submitted = {
  play: async ({ args, canvas, step }) => {
    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="common" language="ts"
// ...rest of story file

export const Submitted: Story = {
  play: async ({ args, canvas, step }) => {
    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```
