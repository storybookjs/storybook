```tsx filename="Page.stories.tsx" renderer="react" language="ts"
export const Default: Story = {
  play: async ({ mount, args }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      <Page {...args} params={{ id: String(note.id) }} />,
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```

```jsx filename="Page.stories.jsx" renderer="react" language="js"
export const Default = {
  play: async ({ mount, args }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      <Page {...args} params={{ id: String(note.id) }} />,
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts"
export const Default: Story = {
  play: async ({ mount, args }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } },
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```

```js filename="Page.stories.js" renderer="svelte" language="js"
export const Default = {
  play: async ({ mount, args }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } },
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```

```ts filename="Page.stories.ts" renderer="vue3" language="ts"
export const Default: Story = {
  play: async ({ mount, args }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } },
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```

```js filename="Page.stories.js" renderer="vue3" language="js"
export const Default = {
  play: async ({ mount, args }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } },
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```
