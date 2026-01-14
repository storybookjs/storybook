```ts filename="Dialog.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';
import { expect } from 'storybook/test';

import { Dialog } from './dialog.component';

const meta: Meta<Dialog> = {
  component: Dialog,
};
export default meta;

type Story = StoryObj<Dialog>;

export const Opens: Story = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```ts filename="Dialog.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

import { Dialog } from './dialog.component';

const meta = preview.meta({
  component: Dialog,
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect } from 'storybook/test';

import { Dialog } from './Dialog';

const meta = {
  component: Dialog,
} satisfies Meta<typeof Dialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Opens: Story = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```js filename="Dialog.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { expect } from 'storybook/test';

import { Dialog } from './Dialog';

export default {
  component: Dialog,
};

export const Opens = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Dialog from './Dialog.svelte';

  const { Story } = defineMeta({
    component: Dialog,
  });
</script>

<Story
  name="Opens"
  play={async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  }}
/>
```

```ts filename="Dialog.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect } from 'storybook/test';

import { Dialog } from './Dialog.svelte';

const meta = {
  component: Dialog,
} satisfies Meta<typeof Dialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Opens: Story = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Dialog from './Dialog.svelte';

  const { Story } = defineMeta({
    component: Dialog,
  });
</script>

<Story
  name="Opens"
  play={async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  }}
/>
```

```js filename="Dialog.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { expect } from 'storybook/test';

import { Dialog } from './Dialog.svelte';

export default {
  component: Dialog,
};

export const Opens = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```ts filename="Dialog.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';

const meta: Meta = {
  component: 'demo-dialog',
};
export default meta;

type Story = StoryObj;

export const Opens: Story = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```js filename="Dialog.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import { expect } from 'storybook/test';

export default {
  component: 'demo-dialog',
};

export const Opens = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```js filename="Dialog.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-dialog',
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-dialog',
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Dialog.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

import Dialog from './Dialog.vue';

const meta = preview.meta({
  component: Dialog,
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Dialog.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { fn, expect } from 'storybook/test';

import preview from '../.storybook/preview';

import Dialog from './Dialog.vue';

const meta = preview.meta({
  component: Dialog,
});

export const Opens = meta.story({
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
});
```
