```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnImage: Story = {
  render: () => ({
    props: {
      src: 'https://storybook.js.org/images/placeholders/350x150.png',
      alt: 'My CDN placeholder',
    },
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  component: MyComponent,
});

export const WithAnImage = meta.story({
  render: () => ({
    props: {
      src: 'https://storybook.js.org/images/placeholders/350x150.png',
      alt: 'My CDN placeholder',
    },
  }),
});
```

```jsx filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const WithAnImage = {
  render: () => (
    <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder" />
  ),
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnImage: Story = {
  render: () => (
    <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder" />
  ),
};
```

```jsx filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const WithAnImage = {
  render: () => (
    <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder" />
  ),
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

export const WithAnImage: Story = {
  render: () => (
    <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder" />
  ),
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
  <MyComponent
    src="https://storybook.js.org/images/placeholders/350x150.png"
    alt="My CDN placeholder"
  />
</Story>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const WithAnImage = {
  render: () => ({
    Component: MyComponent,
    props: {
      src: 'https://storybook.js.org/images/placeholders/350x150.png',
      alt: 'My CDN placeholder',
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
  <MyComponent
    src="https://storybook.js.org/images/placeholders/350x150.png"
    alt="My CDN placeholder"
  />
</Story>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnImage: Story = {
  render: () => ({
    Component: MyComponent,
    props: {
      src: 'https://storybook.js.org/images/placeholders/350x150.png',
      alt: 'My CDN placeholder',
    },
  }),
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

export const WithAnImage = {
  render: () => ({
    template:
      '<img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder"/>',
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnImage: Story = {
  render: () => ({
    template:
      '<img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder"/>',
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const WithAnImage = meta.story({
  render: () => ({
    template:
      '<img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder"/>',
  }),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const WithAnImage = meta.story({
  render: () => ({
    template:
      '<img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder"/>',
  }),
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import { html } from 'lit';

export default {
  component: 'my-component',
};

export const WithAnImage = {
  render: () =>
    html`<img
      src="https://storybook.js.org/images/placeholders/350x150.png"
      alt="My CDN placeholder"
    />`,
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const WithAnImage: Story = {
  render: () =>
    html`<img
      src="https://storybook.js.org/images/placeholders/350x150.png"
      alt="My CDN placeholder"
    />`,
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const WithAnImage = meta.story({
  render: () =>
    html`<img
      src="https://storybook.js.org/images/placeholders/350x150.png"
      alt="My CDN placeholder"
    />`,
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const WithAnImage = meta.story({
  render: () =>
    html`<img
      src="https://storybook.js.org/images/placeholders/350x150.png"
      alt="My CDN placeholder"
    />`,
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const WithAnImage = meta.story({
  render: () => (
    <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder" />
  ),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const WithAnImage = meta.story({
  render: () => (
    <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="My CDN placeholder" />
  ),
});
```
