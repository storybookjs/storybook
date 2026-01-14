```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';
import { mocked } from 'storybook/test';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta: Meta<Page> = {
  component: Page,
};
export default meta;

type Story = StoryObj<Page>;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  // 👇 Automocked module resolves to '../lib/__mocks__/session'
  import { getUserFromSession } from '../lib/session';

  import Page from './Page.svelte';

  const meta = defineMeta({
    component: Page,
  });
</script>

<Story name="Default" beforeEach={() => {
  // 👇 Set the return value for the getUserFromSession function
  getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
}} />
```

```js filename="Page.stories.js" renderer="svelte" language="js" tabTitle="CSF"
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import Page from './Page.svelte';

export default {
  component: Page,
};

export const Default = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

export default {
  component: Page,
};

export const Default = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { mocked } from 'storybook/test';

  // 👇 Automocked module resolves to '../lib/__mocks__/session'
  import { getUserFromSession } from '../lib/session';

  import Page from './Page.svelte';

  const meta = defineMeta({
    component: Page,
  });
</script>

<Story name="Default" beforeEach={() => {
  // 👇 Set the return value for the getUserFromSession function
  mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
}} />
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';
import { mocked } from 'storybook/test';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import Page from './Page.svelte';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
import { mocked } from 'storybook/test';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

export default {
  component: 'my-page',
};

export const Default = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { mocked } from 'storybook/test';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

const meta: Meta = {
  component: 'my-page',
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: 'my-page',
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: 'my-page',
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
});

export const Default = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```
