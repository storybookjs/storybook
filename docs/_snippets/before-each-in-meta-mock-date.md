```ts filename="Page.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import MockDate from 'mockdate';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';
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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MockDate from 'mockdate';

  // 👇 Must include the `.mock` portion of filename to have mocks typed correctly
  import { getUserFromSession } from '#api/session.mock';

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

<Story name="Default" play={async ({ canvasElement }) => {
  // ... This will run with the mocked Date
  }}
/>
```

```js filename="Page.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MockDate from 'mockdate';

import { getUserFromSession } from '#api/session.mock';

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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js"
import MockDate from 'mockdate';

import { getUserFromSession } from '#api/session.mock';
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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MockDate from 'mockdate';

  // 👇 Must include the `.mock` portion of filename to have mocks typed correctly
  import { getUserFromSession } from '#api/session.mock';

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

<Story name="Default" play={async ({ canvasElement }) => {
  // ... This will run with the mocked Date
  }}
/>
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import MockDate from 'mockdate';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';
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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';

import MockDate from 'mockdate';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';
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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js"
import MockDate from 'mockdate';

import { getUserFromSession } from '../../api/session.mock';

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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import MockDate from 'mockdate';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

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
  async play({ canvasElement }) {
    // ... This will run with the mocked Date
  },
};
```
