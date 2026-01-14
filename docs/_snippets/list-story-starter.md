```ts filename="List.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { List } from './list.component';

const meta: Meta<List> = {
  component: List,
  decorators: [
    moduleMetadata({
      declarations: [List],
      imports: [CommonModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<List>;

// Always an empty list, not super interesting
export const Empty: Story = {
  render: (args) => ({
    props: args,
    template: `<app-list></app-list>`,
  }),
};
```

```ts filename="List.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { CommonModule } from '@angular/common';

import { moduleMetadata } from '@storybook/angular';
import preview from '../.storybook/preview';

import { List } from './list.component';

const meta = preview.meta({
  component: List,
  decorators: [
    moduleMetadata({
      declarations: [List],
      imports: [CommonModule],
    }),
  ],
});

// Always an empty list, not super interesting
export const Empty = meta.story({
  render: (args) => ({
    props: args,
    template: `<app-list></app-list>`,
  }),
});
```

```js filename="List.stories.js" renderer="html" language="js"
import { createList } from './List';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
};

// Always an empty list, not super interesting
export const Empty = {
  render: (args) => createList(args),
};
```

```ts filename="List.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

import { createList, ListArgs } from './List';

const meta: Meta<ListArgs> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
};

export default meta;
type Story = StoryObj<ListArgs>;

// Always an empty list, not super interesting
export const Empty: Story = {
  render: (args) => createList(args),
};
```

```js filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { List } from './List';

export default {
  component: List,
};

// Always an empty list, not super interesting
export const Empty = {};
```

```ts filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { List } from './List';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// Always an empty list, not super interesting
export const Empty: Story = {};
```

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';

export default {
  component: List,
};

// Always an empty list, not super interesting
export const Empty = {};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { List } from './List';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// Always an empty list, not super interesting
export const Empty: Story = {};
```

```svelte filename="List.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<!-- Always an empty list, not super interesting -->
<Story name="Empty" />
```

```js filename="List.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import List from './List.svelte';

export default {
  component: List,
};

// Always an empty list, not super interesting
export const Empty = {};
```

```svelte filename="List.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<!-- Always an empty list, not super interesting -->
<Story name="Empty" />
```

```ts filename="List.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import List from './List.svelte';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// Always an empty list, not super interesting
export const Empty: Story = {};
```

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import List from './ListComponent.vue';

export default {
  component: List,
};

// Always an empty list, not super interesting
export const Empty = {
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import List from './ListComponent.vue';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// Always an empty list, not super interesting
export const Empty: Story = {
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import List from './ListComponent.vue';

const meta = preview.meta({
  component: List,
});

// Always an empty list, not super interesting
export const Empty = meta.story({
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import List from './ListComponent.vue';

const meta = preview.meta({
  component: List,
});

// Always an empty list, not super interesting
export const Empty = meta.story({
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
});
```

```js filename="List.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import { html } from 'lit';

export default {
  component: 'demo-list',
};

// Always an empty list, not super interesting
export const Empty = {
  render: () => html`<demo-list></demo-list>`,
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-list',
};

export default meta;
type Story = StoryObj;

// Always an empty list, not super interesting
export const Empty: Story = {
  render: () => html`<demo-list></demo-list>`,
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-list',
});

// Always an empty list, not super interesting
export const Empty = meta.story({
  render: () => html`<demo-list></demo-list>`,
});
```

```js filename="List.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-list',
});

// Always an empty list, not super interesting
export const Empty = meta.story({
  render: () => html`<demo-list></demo-list>`,
});
```

```ts filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { List } from './List';

const meta = preview.meta({
  component: List,
});

// Always an empty list, not super interesting
export const Empty = meta.story();
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { List } from './List';

const meta = preview.meta({
  component: List,
});

// Always an empty list, not super interesting
export const Empty = meta.story();
```
