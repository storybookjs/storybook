```ts filename="YourComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { YourComponent } from './your.component';

//👇 This default export determines where your story goes in the story list
const meta: Meta<YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<YourComponent>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```js filename="YourComponent.stories.js" renderer="html" language="js"
import { createYourComponent } from './YourComponent';

// 👇 This default export determines where your story goes in the story list
export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'YourComponent',
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const FirstStory = {
  render: (args) => createYourComponent(args),
  args: {
    // 👇 The args you need here will depend on your component
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

import { createYourComponent, ComponentProps } from './YourComponent';

//👇 This default export determines where your story goes in the story list
const meta: Meta<ComponentProps> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'YourComponent',
};

export default meta;
type Story = StoryObj<ComponentProps>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const FirstStory: Story = {
  render: (args) => createYourComponent(args),
  args: {
    // 👇 The args you need here will depend on your component
  },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="preact" language="js"
/** @jsx h */
import { h } from 'preact';

import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
export default {
  component: YourComponent,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const FirstStory = {
  render: (args) => <YourComponent {...args} />,
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js"
import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
export default {
  component: YourComponent,
};

export const FirstStory = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
const meta = {
  component: YourComponent,
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="solid" language="js"
import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
export default {
  component: YourComponent,
};

export const FirstStory = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
const meta = {
  component: YourComponent,
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  //👇 This export determines where your story goes in the story list
  const { Story } = defineMeta({
    component: YourComponent,
  });
</script>

<Story
  name="FirstStory"
  args={{
    /*👇 The args you need here will depend on your component */
  }}
/>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import YourComponent from './YourComponent.svelte';

//👇 This default export determines where your story goes in the story list
export default {
  component: YourComponent,
};

export const FirstStory = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  //👇 This export determines where your story goes in the story list
  const { Story } = defineMeta({
    component: YourComponent,
  });
</script>

<Story
  name="FirstStory"
  args={{
    /*👇 The args you need here will depend on your component */
  }}
/>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

//👇 This default export determines where your story goes in the story list
const meta = {
  component: YourComponent,
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  //👇 This export determines where your story goes in the story list
  const { Story } = defineMeta({
    component: YourComponent,
  });
</script>

<Story
  name="FirstStory"
  args={{
    /*👇 The args you need here will depend on your component */
  }}
/>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

//👇 This default export determines where your story goes in the story list
const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStory: Story = {
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```js filename="YourComponent.stories.js" renderer="vue" language="js" tabTitle="3"
import YourComponent from './YourComponent.vue';

//👇 This default export determines where your story goes in the story list
export default {
  component: YourComponent,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const FirstStory = {
  render: (args) => ({
    components: { YourComponent },
    setup() {
      return { args };
    },
    template: '<YourComponent v-bind="args" />',
  }),
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```ts filename="YourComponent.stories.js" renderer="vue" language="ts-4-9" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import YourComponent from './YourComponent.vue';

const meta = {
  component: YourComponent,
} satisfies Meta<typeof YourComponent>;

//👇 This default export determines where your story goes in the story list
export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args) => ({
    components: { YourComponent },
    setup() {
      return { args };
    },
    template: '<YourComponent v-bind="args" />',
  }),
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import YourComponent from './YourComponent.vue';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
};

//👇 This default export determines where your story goes in the story list
export default meta;
type Story = StoryObj<typeof YourComponent>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args) => ({
    components: { YourComponent },
    setup() {
      return { args };
    },
    template: '<YourComponent v-bind="args" />',
  }),
  args: {
    //👇 The args you need here will depend on your component
  },
};
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js"
// This default export determines where your story goes in the story list
export default {
  component: 'demo-your-component',
};

export const FirstStory = {
  args: {
    // 👇 The args you need here will depend on your component
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

// This default export determines where your story goes in the story list
const meta: Meta = {
  component: 'demo-your-component',
};

export default meta;
type Story = StoryObj;

export const FirstStory: Story = {
  args: {
    // 👇 The args you need here will depend on your component
  },
};
```
