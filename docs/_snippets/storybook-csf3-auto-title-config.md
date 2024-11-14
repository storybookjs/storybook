```js filename="./storybook/main.js" renderer="common" language="js" tabTitle="main-js"
export default {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
  framework: '@storybook/your-framework',
  stories: ['../src'],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="main-ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src'],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts-4-9" tabTitle="main-ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src'],
};

export default config;
```

```ts filename="src/app/components/MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="csf3-story"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js|jsx" renderer="preact" language="js" tabTitle="csf3-story"
/** @jsx h */
import { h } from 'preact';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
export default {
  component: MyComponent,
};

export const Default = {
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="csf3-story"
import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
export default {
  component: MyComponent,
};

export const Default = {
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="csf3-story"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="csf3-story"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js|jsx" renderer="solid" language="js" tabTitle="csf3-story"
import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
export default {
  component: MyComponent,
};

export const Default = {
  args: { message: 'Hello world!' },
};
```

```tsx filename="src/components/MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9" tabTitle="csf3-story"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```tsx filename="src/components/MyComponent.stories.ts|tsx" renderer="solid" language="ts" tabTitle="csf3-story"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const FirstStory: Story = {
  args: { message: 'Hello world!' },
};
```

```js filename=""src/components/MyComponent.stories.js" renderer="svelte" language="js" tabTitle="csf3-story"
import MyComponent from './MyComponent.svelte';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
export default {
  component: MyComponent,
};

export const Default = {
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="csf3-story"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="csf3-story"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js" renderer="vue" language="js" tabTitle="csf3-story-2"
import MyComponent from './MyComponent.vue';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
export default {
  component: MyComponent,
};

export const Default = {
  render: (args, { argTypes }) => ({
    components: { MyComponent },
    props: Object.keys(argTypes),
    template: '<MyComponent v-bind="$props" />',
  }),
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="vue" language="ts-4-9" tabTitle="csf3-story-2"
import type { Meta, StoryObj } from '@storybook/vue';

import MyComponent from './MyComponent.vue';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

//👇 This default export determines where your story goes in the story list
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args, { argTypes }) => ({
    components: { MyComponent },
    props: Object.keys(argTypes),
    template: '<MyComponent v-bind="$props" />',
  }),
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="csf3-story-2"
import type { Meta, StoryObj } from '@storybook/vue';

import MyComponent from './MyComponent.vue';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  render: (args, { argTypes }) => ({
    components: { MyComponent },
    props: Object.keys(argTypes),
    template: '<MyComponent v-bind="$props" />',
  }),
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js" renderer="vue" language="js" tabTitle="csf3-story-3"
import MyComponent from './MyComponent.vue';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
export default {
  component: MyComponent,
};

export const Default = {
  render: (args) => ({
    components: { MyComponent },
    setup() {
      return { args };
    },
    template: '<MyComponent v-bind="args" />',
  }),
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="vue" language="ts-4-9" tabTitle="csf3-story-3"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => ({
    components: { MyComponent },
    setup() {
      return { args };
    },
    template: '<MyComponent v-bind="args" />',
  }),
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="csf3-story-3"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/7/api/csf
 * to learn more about it.
 */
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  render: (args) => ({
    components: { MyComponent },
    setup() {
      return { args };
    },
    template: '<MyComponent v-bind="args" />',
  }),
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js" renderer="web-components" language="js" tabTitle="csf3-story"
/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/api/csf
 * to learn more about it.
 */
export default {
  component: 'demo-your-component',
};

export const Default = {
  args: { message: 'Hello world!' },
};
```

```ts filename="src/components/MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="csf3-story"
import type { Meta, StoryObj } from '@storybook/web-components';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/api/csf
 * to learn more about it.
 */
const meta: Meta = {
  component: 'demo-your-component',
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```
