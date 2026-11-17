```tsx filename="Page.stories.tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import { Page } from './Page';

const meta = preview.meta({ component: Page });

export const Basic = meta.story({
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
});
```

```jsx filename="Page.stories.jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';
// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Basic = meta.story({
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
});
```

```tsx filename="Page.stories.tsx" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import { Page } from './page.component';

const meta = preview.meta({ component: Page });

export const Basic = meta.story({
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
});
```

```tsx filename="Page.stories.tsx" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import { Page } from './page.component';

const meta = { component: Page } satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  // 👇 Automocked module resolves to '../lib/__mocks__/db'
  import db from '../lib/db';
  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
  });
</script>

<Story
  name="Basic"
  play={async ({ mount, args, userEvent }) => {
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
  }}
  argTypes={{
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  }}
/>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  // 👇 Automocked module resolves to '../lib/__mocks__/db'
  import db from '../lib/db';
  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
  });
</script>

<Story
  name="Basic"
  play={async ({ mount, args, userEvent }) => {
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
  }}
  argTypes={{
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  }}
/>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  // 👇 Automocked module resolves to '../lib/__mocks__/db'
  import db from '../lib/db';
  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
  });
</script>

<Story
  name="Basic"
  play={async ({ mount, args, userEvent }) => {
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
  }}
  argTypes={{
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  }}
/>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  // 👇 Automocked module resolves to '../lib/__mocks__/db'
  import db from '../lib/db';
  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
  });
</script>

<Story
  name="Basic"
  play={async ({ mount, args, userEvent }) => {
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
  }}
  argTypes={{
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  }}
/>
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import Page from './Page.vue';

const meta = preview.meta({ component: Page });

export const Basic = meta.story({
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
});
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import Page from './Page.vue';

const meta = preview.meta({ component: Page });

export const Basic = meta.story({
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
});
```

```tsx filename="Page.stories.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g., react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import { Page } from './Page';

const meta = { component: Page } satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
};
```

```jsx filename="Page.stories.jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import { Page } from './Page';

export default { component: Page };

export const Basic = {
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
};
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/vue3-vite';

// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import Page from './Page.vue';

const meta = { component: Page } satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
};
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// 👇 Automocked module resolves to '../lib/__mocks__/db'
import db from '../lib/db';
import Page from './Page.vue';

export default { component: Page };

export const Basic = {
  play: async ({ mount, args, userEvent }) => {
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
    // 👇 Make the params prop un-controllable, as the value is always overridden in the play function.
    params: { control: { disable: true } },
  },
};
```
