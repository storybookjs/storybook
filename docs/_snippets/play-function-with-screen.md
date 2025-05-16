```ts filename="Dialog.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { screen } from 'storybook/test';

import { Dialog } from './Dialog.component';

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

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
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

```js filename="Dialog.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Dialog from './Dialog.svelte';

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

```js filename="Dialog.stories.js|jsx" renderer="common" language="js"
import { Dialog } from './Dialog';
import { screen } from 'storybook/test';

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

```svelte filename="Dialog.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
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

```ts filename="Dialog.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { screen } from 'storybook/test';

import Dialog from './Dialog.svelte';

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

```ts filename="Dialog.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
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

```js filename="Dialog.stories.js" renderer="web-components" language="js"
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

```ts filename="Dialog.stories.ts" renderer="web-components" language="ts"
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
