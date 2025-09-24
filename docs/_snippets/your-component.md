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

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
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

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

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
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```js filename="YourComponent.stories.js" renderer="vue" language="js"
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

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

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
import type { Meta, StoryObj } from '@storybook/web-components-vite';

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

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { YourComponent } from './YourComponent';

//👇 This default export determines where your story goes in the story list
const meta = preview.meta({
  component: YourComponent,
});

export const FirstStory = meta.story({
  args: {
    //👇 The args you need here will depend on your component
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
});

export const FirstStory = meta.story({
  args: {
    //👇 The args you need here will depend on your component
  },
});
```
