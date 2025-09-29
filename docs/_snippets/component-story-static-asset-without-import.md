```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

// Assume image.png is located in the "public" directory.
export const WithAnImage: Story = {
  render: () => ({
    props: {
      src: '/image.png',
      alt: 'my image',
    },
  }),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

// Assume image.png is located in the "public" directory.
export const WithAnImage = {
  render: () => <img src="/image.png" alt="my image" />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Assume image.png is located in the "public" directory.
export const WithAnImage: Story = {
  render: () => <img src="/image.png" alt="my image" />,
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

// Assume image.png is located in the "public" directory.
export const WithAnImage = {
  render: () => <img src="/image.png" alt="my image" />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Assume image.png is located in the "public" directory.
export const WithAnImage: Story = {
  render: () => <img src="/image.png" alt="my image" />,
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

	const { Story } = defineMeta({
		component: MyComponent,
	});
</script>

<Story name="WithAnImage">
  <MyComponent src="/image.png" alt="my image" />
</Story>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

// Assume image.png is located in the "public" directory.
export const WithAnImage = {
  render: () => ({
    Component: MyComponent,
    props: {
      src: '/image.png',
      alt: 'my image',
    },
  }),
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

	const { Story } = defineMeta({
		component: MyComponent,
	});
</script>

<Story name="WithAnImage">
  <MyComponent src="/image.png" alt="my image" />
</Story>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Assume image.png is located in the "public" directory.
export const WithAnImage: Story = {
  render: () => ({
    Component: MyComponent,
    props: {
      src: '/image.png',
      alt: 'my image',
    },
  }),
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

// Assume image.png is located in the "public" directory.
export const WithAnImage = {
  render: () => ({
    template: '<img src="image.png" alt="my image" />',
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnImage: Story = {
  render: () => ({
    template: '<img src="image.png" alt="my image" />',
  }),
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'my-component',
};

// Assume image.png is located in the "public" directory.
export const WithAnImage = {
  render: () => html`<img src="/image.png" alt="image" />`,
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

// Assume image.png is located in the "public" directory.
export const WithAnImage: Story = {
  render: () => html`<img src="/image.png" alt="image" />`,
};
```
