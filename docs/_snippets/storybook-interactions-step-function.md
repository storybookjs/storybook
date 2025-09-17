```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
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

```ts filename="MyComponent.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
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

```ts filename="MyComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// ...rest of story file

export const Submitted = meta.story({
  play: async ({ args, canvas, step }) => {
    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// ...rest of story file

export const Submitted = meta.story({
  play: async ({ args, canvas, step }) => {
    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
});
```
