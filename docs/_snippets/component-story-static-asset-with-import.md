```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

import imageFile from './static/image.png';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage: Story = {
  render: () => ({
    props: {
      src: image.src,
      alt: image.alt,
    },
    template: `<img src="{{src}}" alt="{{alt}}" />`,
  }),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

import imageFile from './static/image.png';

export default {
  component: MyComponent,
};

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = {
  render: () => <img src={image.src} alt={image.alt} />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import imageFile from './static/image.png';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage: Story = {
  render: () => <img src={image.src} alt={image.alt} />,
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import imageFile from './static/image.png';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = {
  render: () => <img src={image.src} alt={image.alt} />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import imageFile from './static/image.png';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage: Story = {
  render: () => <img src={image.src} alt={image.alt} />,
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  import imageFile from './static/image.png';

  let image = {
    src: imageFile,
    alt: 'my image',
  };

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story name="WithAnImage">
  <MyComponent {image} />
</Story>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

import imageFile from './static/image.png';

export default {
  component: MyComponent,
};

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = {
  render: () => ({
    Component: MyComponent,
    props: image,
  }),
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  import imageFile from './static/image.png';

  let image = {
    src: imageFile,
    alt: 'my image',
  };

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story name="WithAnImage">
	<MyComponent {image} />
</Story>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import MyComponent from './MyComponent.svelte';

import imageFile from './static/image.png';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage: Story = {
  render: () => ({
    Component: MyComponent,
    props: image,
  }),
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import MyComponent from './MyComponent.vue';

import imageFile from './static/image.png';

export default {
  component: MyComponent,
};

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = {
  render: () => ({
    setup() {
      //👇 Returns the content of the image object create above.
      return { image };
    },
    template: `<img v-bind="image"/>`,
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyComponent from './MyComponent.vue';

import imageFile from './static/image.png';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

const image = {
  src: imageFile,
  alt: 'my image',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnImage: Story = {
  render: () => ({
    setup() {
      //👇 Returns the content of the image object create above.
      return { image };
    },
    template: `<img v-bind="image"/>`,
  }),
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

import imageFile from './static/image.png';

export default {
  component: 'my-component',
};

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = {
  render: () => html`<img src="${image.src}" alt="${image.alt}" /> `,
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

import imageFile from './static/image.png';

const meta: Meta = {
  component: 'my-component',
};

const image = {
  src: imageFile,
  alt: 'my image',
};

export default meta;
type Story = StoryObj;

export const WithAnImage: Story = {
  render: () => html`<img src="${image.src}" alt="${image.alt}" />`,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import imageFile from './static/image.png';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = meta.story({
  render: () => <img src={image.src} alt={image.alt} />,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { MyComponent } from './MyComponent';

import imageFile from './static/image.png';

const meta = preview.meta({
  component: MyComponent,
});

const image = {
  src: imageFile,
  alt: 'my image',
};

export const WithAnImage = meta.story({
  render: () => <img src={image.src} alt={image.alt} />,
});
```
