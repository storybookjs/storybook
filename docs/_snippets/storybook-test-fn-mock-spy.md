```ts filename="NoteUI.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { expect, userEvent, within } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

import NoteUI from './note-ui';

const meta: Meta<NoteUI> = {
  title: 'Mocked/NoteUI',
  component: NoteUI,
};
export default meta;

type Story = StoryObj<NoteUI>;

const notes = createNotes();

export const SaveFlow: Story = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```svelte filename="NoteUI.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { expect, userEvent, within } from 'storybook/test';

  // 👇 Must include the `.mock` portion of filename to have mocks typed correctly
  import { saveNote } from '#app/actions.mock';
  import { createNotes } from '#mocks/notes';

  import NoteUI from './note-ui.svelte';

  const meta = defineMeta({
    title: 'Mocked/NoteUI',
    component: NoteUI,
  });
</script>

<script>
  const notes = createNotes();
</script>

<Story name="Save Flow ▶"
  args={{ isEditing: true, note: notes[0] }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  }} />
```

```js filename="NoteUI.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { expect, userEvent, within } from 'storybook/test';

import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

import NoteUI from './note-ui.svelte';

export default {
  title: 'Mocked/NoteUI',
  component: NoteUI,
};

const notes = createNotes();

export const SaveFlow = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```js filename="NoteUI.stories.js" renderer="common" language="js"
import { expect, userEvent, within } from 'storybook/test';

import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

import NoteUI from './note-ui';

export default {
  title: 'Mocked/NoteUI',
  component: NoteUI,
};

const notes = createNotes();

export const SaveFlow = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```svelte filename="NoteUI.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { expect, userEvent, within } from 'storybook/test';

  // 👇 Must include the `.mock` portion of filename to have mocks typed correctly
  import { saveNote } from '#app/actions.mock';
  import { createNotes } from '#mocks/notes';

  import NoteUI from './note-ui.svelte';

  const meta = defineMeta({
    title: 'Mocked/NoteUI',
    component: NoteUI,
  });
</script>

<script>
  const notes = createNotes();
</script>

<Story name="Save Flow ▶"
  args={{ isEditing: true, note: notes[0] }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  }} />
```

```ts filename="NoteUI.stories.ts" renderer="common" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import { expect, userEvent, within } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

import NoteUI from './note-ui.svelte';

const meta = {
  title: 'Mocked/NoteUI',
  component: NoteUI,
} satisfies Meta<typeof NoteUI>;
export default meta;

type Story = StoryObj<typeof meta>;

const notes = createNotes();

export const SaveFlow: Story = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```ts filename="NoteUI.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { expect, userEvent, within } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

import NoteUI from './note-ui';

const meta = {
  title: 'Mocked/NoteUI',
  component: NoteUI,
} satisfies Meta<typeof NoteUI>;
export default meta;

type Story = StoryObj<typeof meta>;

const notes = createNotes();

export const SaveFlow: Story = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```js filename="NoteUI.stories.js" renderer="web-components" language="js"
import { expect, userEvent, within } from 'storybook/test';

import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

export default {
  title: 'Mocked/NoteUI',
  component: 'note-ui',
};

const notes = createNotes();

export const SaveFlow = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```ts filename="NoteUI.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { expect, userEvent, within } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { saveNote } from '#app/actions.mock';
import { createNotes } from '#mocks/notes';

const meta: Meta = {
  title: 'Mocked/NoteUI',
  component: 'note-ui',
};
export default meta;

type Story = StoryObj;

const notes = createNotes();

export const SaveFlow: Story = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```
