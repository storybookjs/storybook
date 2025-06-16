```tsx filename="Page.stories.tsx" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g., react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import db from '#lib/db.mock';
import { Page } from './Page';

const meta = { component: Page } satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ mount, args, userEvent }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      <Page {...args} params={{ id: String(note.id) }} />
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
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import db from '#lib/db.mock';
import { Page } from './Page';

export default { component: Page };

export const Default = {
  play: async ({ mount, args, userEvent }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      <Page {...args} params={{ id: String(note.id) }} />
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
// Replace your-framework with the framework you are using, e.g., svelte-vite, sveltekit, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import db from '#lib/db.mock';
import { Page } from './Page';

const meta = { component: Page } satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ mount, args, userEvent }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } }
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
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import db from '#lib/db.mock';
import { Page } from './Page';

export default { component: Page };

export const Default = {
  play: async ({ mount, args, userEvent }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } }
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
import type { Meta, StoryObj } from '@storybook/vue3-vite';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import db from '#lib/db.mock';
import { Page } from './Page';

const meta = { component: Page } satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ mount, args, userEvent }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } }
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
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import db from '#lib/db.mock';
import { Page } from './Page';

export default { component: Page };

export const Default = {
  play: async ({ mount, args, userEvent }) => {
    const note = await db.note.create({
      data: { title: 'Mount inside of play' },
    });

    const canvas = await mount(
      Page,
      // 👇 Pass data that is created inside of the play function to the component
      //   For example, a just-generated UUID
      { props: { ...args, params: { id: String(note.id) } } }
    );

    await userEvent.click(await canvas.findByRole('menuitem', { name: /login to add/i }));
  },
  argTypes: {
    // 👇 Make the params prop un-controllable, as the value is always overriden in the play function.
    params: { control: { disable: true } },
  },
};
```
