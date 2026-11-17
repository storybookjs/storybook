```ts filename="Dialog.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

import { Dialog } from './dialog.component';

const meta = preview.meta({
  component: Dialog,
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-dialog',
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';
  import { screen } from 'storybook/test';

  import Dialog from './Dialog.svelte';

  const { Story } = preview.meta({
    component: Dialog,
  });
</script>

<Story
  name="Open"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  }} />
```

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
  import { screen } from 'storybook/test';

  import Dialog from './Dialog.svelte';

  const { Story } = defineMeta({
    component: Dialog,
  });
</script>

<Story
  name="Open"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  }} />
```

```js filename="Dialog.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-dialog',
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';
  import { screen } from 'storybook/test';

  import Dialog from './Dialog.svelte';

  const { Story } = preview.meta({
    component: Dialog,
  });
</script>

<Story
  name="Open"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  }} />
```

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
  import { screen } from 'storybook/test';

  import Dialog from './Dialog.svelte';

  const { Story } = defineMeta({
    component: Dialog,
  });
</script>

<Story
  name="Open"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  }} />
```

```ts filename="Dialog.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```js filename="Dialog.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

import Dialog from './Dialog.vue';

const meta = preview.meta({
  component: Dialog,
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```js filename="Dialog.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { screen } from 'storybook/test';

import preview from '../.storybook/preview';

import Dialog from './Dialog.vue';

const meta = preview.meta({
  component: Dialog,
});

export const Open = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
});
```

```ts filename="Dialog.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';
import { screen } from 'storybook/test';

import { Dialog } from './dialog.component';

const meta: Meta<Dialog> = {
  component: Dialog,
};
export default meta;

type Story = StoryObj<Dialog>;

export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
};
```

```ts filename="Dialog.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
import { screen } from 'storybook/test';

import { Dialog } from './Dialog';

const meta = {
  component: Dialog,
} satisfies Meta<typeof Dialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
};
```

```js filename="Dialog.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { screen } from 'storybook/test';

import { Dialog } from './Dialog';

export default {
  component: Dialog,
};

export const Open = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
};
```

```ts filename="Dialog.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { screen } from 'storybook/test';

const meta: Meta = {
  component: 'demo-dialog',
};
export default meta;

type Story = StoryObj;

export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
};
```

```js filename="Dialog.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { screen } from 'storybook/test';

export default {
  component: 'demo-dialog',
};

export const Open = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));

    // Starts querying from the document
    const dialog = screen.getByRole('dialog');
    await expect(dialog).toBeVisible();
  },
};
```
