```ts filename="Page.stories.ts" renderer="angular" language="ts"
import { moduleMetadata } from '@storybook/angular';

import type { Meta, StoryObj } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { Button } from './button.component';
import { Header } from './header.component';
import { Page } from './page.component';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta<Page> = {
  component: Page,
  decorators: [
    moduleMetadata({
      declarations: [Button, Header],
      imports: [CommonModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<Page>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```js filename="Page.stories.js|jsx" renderer="react" language="js"
import { Page } from './Page';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

export default {
  component: Page,
};

export const LoggedIn = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Page } from './Page';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Page } from './Page';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta<typeof Page> = {
  component: Page,
};

export default meta;
type Story = StoryObj<typeof Page>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```js filename="Page.stories.js|jsx" renderer="solid" language="js"
import { Page } from './Page';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

export default {
  component: Page,
};

export const LoggedIn = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```tsx filename="Page.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Page } from './Page';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```tsx filename="Page.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Page } from './Page';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta<typeof Page> = {
  component: Page,
};

export default meta;
type Story = StoryObj<typeof Page>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```js filename="Page.stories.js" renderer="svelte" language="js"
import Page from './Page.svelte';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

export default {
  component: Page,
};

export const LoggedIn = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import Page from './Page.svelte';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import Page from './Page.svelte';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta<typeof Page> = {
  component: Page,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="2--ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue';

import Page from './Page.vue';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta = {
  component: Page,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args, { argTypes }) => ({
    components: { Page },
    props: Object.keys(argTypes),
    template: '<page v-bind="$props" />',
  }),
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="2"
import Page from './Page.vue';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

export default {
  component: Page,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const LoggedIn = {
  render: (args, { argTypes }) => ({
    components: { Page },
    props: Object.keys(argTypes),
    template: '<page v-bind="$props" />',
  }),
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="2"
import type { Meta, StoryObj } from '@storybook/vue';

import Page from './Page.vue';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta<typeof Page> = {
  component: Page,
};

export default meta;
type Story = StoryObj<typeof Page>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args, { argTypes }) => ({
    components: { Page },
    props: Object.keys(argTypes),
    template: '<page v-bind="$props" />',
  }),
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="3"
import Page from './Page.vue';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

export default {
  component: Page,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const LoggedIn = {
  render: (args) => ({
    components: { Page },
    setup() {
      return { args };
    },
    template: '<page v-bind="args" />',
  }),
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="vue" language="ts-4-9" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import Page from './Page.vue';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args) => ({
    components: { Page },
    setup() {
      return { args };
    },
    template: '<page v-bind="args" />',
  }),
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import Page from './Page.vue';

//👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta<typeof Page> = {
  component: Page,
};

export default meta;
type Story = StoryObj<typeof Page>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args) => ({
    components: { Page },
    setup() {
      return { args };
    },
    template: '<page v-bind="args" />',
  }),
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js"
// 👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

export default {
  component: 'demo-page',
};

export const LoggedIn = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

// 👇 Imports all Header stories
import * as HeaderStories from './Header.stories';

const meta: Meta = {
  component: 'demo-page',
};

export default meta;
type Story = StoryObj;

export const LoggedIn: Story = {
  args: {
    ...HeaderStories.LoggedIn.args,
  },
};
```
