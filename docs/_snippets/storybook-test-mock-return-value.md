```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page.component';

const meta = preview.meta({
  component: Page,
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: 'my-page',
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  // 👇 Automocked module resolves to '../lib/__mocks__/session'
  import { getUserFromSession } from '../lib/session';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
  });
</script>

<Story name="Default" beforeEach={() => {
  // 👇 Set the return value for the getUserFromSession function
  getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
}} />
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  // 👇 Automocked module resolves to '../lib/__mocks__/session'
  import { getUserFromSession } from '../lib/session';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
  });
</script>

<Story name="Default" beforeEach={() => {
  // 👇 Set the return value for the getUserFromSession function
  getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
}} />
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: 'my-page',
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';
  import { mocked } from 'storybook/test';

  // 👇 Automocked module resolves to '../lib/__mocks__/session'
  import { getUserFromSession } from '../lib/session';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
  });
</script>

<Story name="Default" beforeEach={() => {
  // 👇 Set the return value for the getUserFromSession function
  mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
}} />
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
  import { mocked } from 'storybook/test';

  // 👇 Automocked module resolves to '../lib/__mocks__/session'
  import { getUserFromSession } from '../lib/session';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
  });
</script>

<Story name="Default" beforeEach={() => {
  // 👇 Set the return value for the getUserFromSession function
  mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
}} />
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { mocked } from 'storybook/test';

import preview from '../.storybook/preview';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
});

export const Basic = meta.story({
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
});
```

```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';
import { mocked } from 'storybook/test';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page.component';

const meta: Meta<Page> = {
  component: Page,
};
export default meta;

type Story = StoryObj<Page>;

export const Basic: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

export const Basic: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

import { Page } from './Page';

export default {
  component: Page,
};

export const Basic = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { mocked } from 'storybook/test';

// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

const meta: Meta = {
  component: 'my-page',
};
export default meta;

type Story = StoryObj;

export const Basic: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    mocked(getUserFromSession).mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// 👇 Automocked module resolves to '../lib/__mocks__/session'
import { getUserFromSession } from '../lib/session';

export default {
  component: 'my-page',
};

export const Basic = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```
