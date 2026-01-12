```ts filename="Page.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Page } from './Page';

const meta: Meta<Page> = {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};
export default meta;

type Story = StoryObj<Page>;

export const Default: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const meta = defineMeta({
    component: Page,
    // 👇 Runs after each story in this file
    async afterEach(context) {
      console.log(`✅ Tested ${context.name} story`);
    },
  });
</script>

<Story name="Default" play={async ({ canvas }) => {
  // ...
  }}
/>
```

```js filename="Page.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Page from './Page.svelte';

export default {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};

export const Default = {
  async play({ canvas }) {
    // ...
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { Page } from './Page';

export default {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};

export const Default = {
  async play({ canvas }) {
    // ...
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const meta = defineMeta({
    component: Page,
    // 👇 Runs after each story in this file
    async afterEach(context) {
      console.log(`✅ Tested ${context.name} story`);
    },
  });
</script>

<Story name="Default" play={async ({ canvas }) => {
  // ...
  }}
/>
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Page from './Page.svelte';

const meta = {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
} satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Page } from './Page';

const meta = {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
} satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-page',
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};

export const Default = {
  async play({ canvas }) {
    // ...
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-page',
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```
