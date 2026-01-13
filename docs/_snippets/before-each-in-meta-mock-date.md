```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import MockDate from 'mockdate';

import { Page } from './Page';

const meta: Meta<Page> = {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};
export default meta;

type Story = StoryObj<Page>;

export const Default: Story = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import MockDate from 'mockdate';
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MockDate from 'mockdate';

  import Page from './Page.svelte';

  const meta = defineMeta({
    component: Page,
    // 👇 Set the value of Date for every story in the file
    async beforeEach() {
      MockDate.set('2024-02-14');

      // 👇 Reset the Date after each story
      return () => {
        MockDate.reset();
      };
    },
  });
</script>

<Story name="Default" play={async ({ canvas }) => {
  // ... This will run with the mocked Date
  }}
/>
```

```js filename="Page.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MockDate from 'mockdate';

import Page from './Page.svelte';

export default {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export const Default = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import MockDate from 'mockdate';

import { Page } from './Page';

export default {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export const Default = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MockDate from 'mockdate';

  import Page from './Page.svelte';

  const meta = defineMeta({
    component: Page,
    // 👇 Set the value of Date for every story in the file
    async beforeEach() {
      MockDate.set('2024-02-14');

      // 👇 Reset the Date after each story
      return () => {
        MockDate.reset();
      };
    },
  });
</script>

<Story name="Default" play={async ({ canvas }) => {
  // ... This will run with the mocked Date
  }}
/>
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import MockDate from 'mockdate';

import Page from './Page.svelte';

const meta = {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
} satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import MockDate from 'mockdate';

import { Page } from './Page';

const meta = {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
} satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js"
import MockDate from 'mockdate';

export default {
  component: 'my-page',
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export const Default = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import MockDate from 'mockdate';

const meta: Meta = {
  component: 'my-page',
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MockDate from 'mockdate';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import MockDate from 'mockdate';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
});
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import MockDate from 'mockdate';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import MockDate from 'mockdate';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  async play({ canvas }) {
    // ... This will run with the mocked Date
  },
});
```
