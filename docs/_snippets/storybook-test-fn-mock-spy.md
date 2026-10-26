```ts filename="NoteUI.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui.component';

const meta = preview.meta({ component: NoteUI });

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```ts filename="NoteUI.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

const meta = preview.meta({
  component: 'note-ui',
});

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```svelte filename="NoteUI.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';
  import { expect } from 'storybook/test';

  // 👇 Automocked module resolves to '../app/__mocks__/actions'
  import { saveNote } from '../app/actions';
  import { createNotes } from '../app/mocks/notes';

  import NoteUI from './note-ui.svelte';

  const { Story } = preview.meta({
    title: 'Mocked/NoteUI',
    component: NoteUI,
  });
</script>

<script>
  const notes = createNotes();
</script>

<Story name="Save Flow ▶"
  args={{ isEditing: true, note: notes[0] }}
  play={async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  }} />
```

```svelte filename="NoteUI.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
  import { expect } from 'storybook/test';

  // 👇 Automocked module resolves to '../app/__mocks__/actions'
  import { saveNote } from '../app/actions';
  import { createNotes } from '../app/mocks/notes';

  import NoteUI from './note-ui.svelte';

  const { Story } = defineMeta({
    title: 'Mocked/NoteUI',
    component: NoteUI,
  });
</script>

<script>
  const notes = createNotes();
</script>

<Story name="Save Flow ▶"
  args={{ isEditing: true, note: notes[0] }}
  play={async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  }} />
```

```svelte filename="NoteUI.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';
  import { expect } from 'storybook/test';

  // 👇 Automocked module resolves to '../app/__mocks__/actions'
  import { saveNote } from '../app/actions';
  import { createNotes } from '../app/mocks/notes';

  import NoteUI from './note-ui.svelte';

  const { Story } = preview.meta({
    title: 'Mocked/NoteUI',
    component: NoteUI,
  });
</script>

<script>
  const notes = createNotes();
</script>

<Story name="Save Flow ▶"
  args={{ isEditing: true, note: notes[0] }}
  play={async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  }} />
```

```svelte filename="NoteUI.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
  import { expect } from 'storybook/test';

  // 👇 Automocked module resolves to '../app/__mocks__/actions'
  import { saveNote } from '../app/actions';
  import { createNotes } from '../app/mocks/notes';

  import NoteUI from './note-ui.svelte';

  const { Story } = defineMeta({
    title: 'Mocked/NoteUI',
    component: NoteUI,
  });
</script>

<script>
  const notes = createNotes();
</script>

<Story name="Save Flow ▶"
  args={{ isEditing: true, note: notes[0] }}
  play={async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  }} />
```

```ts filename="NoteUI.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui';

const meta = preview.meta({ component: NoteUI });

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```js filename="NoteUI.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

const meta = preview.meta({
  component: 'note-ui',
});

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```js filename="NoteUI.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui';

const meta = preview.meta({
  component: NoteUI,
});

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```ts filename="NoteUI.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui.vue';

const meta = preview.meta({ component: NoteUI });

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```js filename="NoteUI.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui.vue';

const meta = preview.meta({
  component: NoteUI,
});

const notes = createNotes();

export const SaveFlow = meta.story({
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
});
```

```ts filename="NoteUI.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';
import { expect } from 'storybook/test';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui.component';

const meta: Meta<NoteUI> = { component: NoteUI };
export default meta;

type Story = StoryObj<NoteUI>;

const notes = createNotes();

export const SaveFlow: Story = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```ts filename="NoteUI.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect } from 'storybook/test';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui';

const meta = { component: NoteUI } satisfies Meta<typeof NoteUI>;
export default meta;

type Story = StoryObj<typeof meta>;

const notes = createNotes();

export const SaveFlow: Story = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```js filename="NoteUI.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { expect } from 'storybook/test';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

import NoteUI from './note-ui';

export default { component: NoteUI };

const notes = createNotes();

export const SaveFlow = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```ts filename="NoteUI.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

const meta: Meta = {
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
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```

```js filename="NoteUI.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { expect } from 'storybook/test';

// 👇 Automocked module resolves to '../app/__mocks__/actions'
import { saveNote } from '../app/actions';
import { createNotes } from '../app/mocks/notes';

export default {
  component: 'note-ui',
};

const notes = createNotes();

export const SaveFlow = {
  name: 'Save Flow ▶',
  args: {
    isEditing: true,
    note: notes[0],
  },
  play: async ({ canvas, userEvent }) => {
    const saveButton = canvas.getByRole('menuitem', { name: /done/i });
    await userEvent.click(saveButton);
    // 👇 This is the mock function, so you can assert its behavior
    await expect(saveNote).toHaveBeenCalled();
  },
};
```
