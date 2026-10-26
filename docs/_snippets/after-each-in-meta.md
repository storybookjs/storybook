```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Page } from './page.component';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-page',
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
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

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
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

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-page',
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
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

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
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

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
});

export const Basic = meta.story({
  async play({ canvas }) {
    // ...
  },
});
```

```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { Page } from './page.component';

const meta: Meta<Page> = {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};
export default meta;

type Story = StoryObj<Page>;

export const Basic: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

export const Basic: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Page } from './Page';

export default {
  component: Page,
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};

export const Basic = {
  async play({ canvas }) {
    // ...
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

export const Basic: Story = {
  async play({ canvas }) {
    // ...
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'my-page',
  // 👇 Runs after each story in this file
  async afterEach(context) {
    console.log(`✅ Tested ${context.name} story`);
  },
};

export const Basic = {
  async play({ canvas }) {
    // ...
  },
};
```
