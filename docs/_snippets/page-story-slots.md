```ts filename="Page.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';

import { Page } from './page.component';

type PagePropsAndCustomArgs = Page & { footer?: string };

const meta: Meta<PagePropsAndCustomArgs> = {
  component: Page,
  render: ({ footer, ...args }) => ({
    props: args,
    template: `
      <storybook-page ${argsToTemplate(args)}>
        <ng-container footer>${footer}</ng-container>
      </storybook-page>`,
  }),
};
export default meta;

type Story = StoryObj<PagePropsAndCustomArgs>;

export const CustomFooter: Story = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```js filename="Page.stories.js|jsx" renderer="react" language="js"
import { Page } from './Page';

export default {
  component: Page,
  render: ({ footer, ...args }) => (
    <Page {...args}>
      <footer>{footer}</footer>
    </Page>
  ),
};

export const CustomFooter = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```tsx filename="Page.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Page } from './Page';

type PagePropsAndCustomArgs = React.ComponentProps<typeof Page> & { footer?: string };

const meta = {
  component: Page,
  render: ({ footer, ...args }) => (
    <Page {...args}>
      <footer>{footer}</footer>
    </Page>
  ),
} satisfies Meta<PagePropsAndCustomArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const CustomFooter = {
  args: {
    footer: 'Built with Storybook',
  },
} satisfies Story;
```

```tsx filename="Page.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Page } from './Page';

type PagePropsAndCustomArgs = React.ComponentProps<typeof Page> & { footer?: string };

const meta: Meta<PagePropsAndCustomArgs> = {
  component: Page,
  render: ({ footer, ...args }) => (
    <Page {...args}>
      <footer>{footer}</footer>
    </Page>
  ),
};
export default meta;

type Story = StoryObj<PagePropsAndCustomArgs>;

export const CustomFooter: Story = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```js filename="Page.stories.js|jsx" renderer="solid" language="js"
import { Page } from './Page';

export default {
  component: Page,
  render: ({ footer, ...args }) => (
    <Page {...args}>
      <footer>{footer}</footer>
    </Page>
  ),
};

export const CustomFooter = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```tsx filename="Page.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { ComponentProps } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Page } from './Page';

type PagePropsAndCustomArgs = ComponentProps<typeof Page> & { footer?: string };

const meta = {
  component: Page,
  render: ({ footer, ...args }) => (
    <Page {...args}>
      <footer>{footer}</footer>
    </Page>
  ),
} satisfies Meta<PagePropsAndCustomArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const CustomFooter = {
  args: {
    footer: 'Built with Storybook',
  },
} satisfies Story;
```

```tsx filename="Page.stories.ts|tsx" renderer="solid" language="ts"
import type { ComponentProps } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Page } from './Page';

type PagePropsAndCustomArgs = ComponentProps<typeof Page> & { footer?: string };

const meta: Meta<PagePropsAndCustomArgs> = {
  component: Page,
  render: ({ footer, ...args }) => (
    <Page {...args}>
      <footer>{footer}</footer>
    </Page>
  ),
};
export default meta;

type Story = StoryObj<PagePropsAndCustomArgs>;

export const CustomFooter: Story = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page
  });
</script>

<Story name="CustomFooter" args={{ footer: 'Built with Storybook' }}>
  {#snippet children(args)}
    <Page {...args} >
      <footer>{args.footer}</footer>
    </Page>
  {/snippet}
</Story>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page
  });
</script>

<Story name="CustomFooter" args={{ footer: 'Built with Storybook' }}>
  {#snippet children(args)}
    <Page {...args} >
      <footer>{args.footer}</footer>
    </Page>
  {/snippet}
</Story>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page
  });
</script>

<Story name="CustomFooter" args={{ footer: 'Built with Storybook' }}>
  {#snippet children(args)}
    <Page {...args} >
      <footer>{args.footer}</footer>
    </Page>
  {/snippet}
</Story>
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="3"
import Page from './Page.vue';

export default {
  component: Page,
  render: (args) => ({
    components: { Page },
    setup() {
      return { args };
    },
    template: `
      <page v-bind="args">
        <template v-slot:footer>
          <footer v-if="args.footer" v-html="args.footer" />
        </template>
      </page>
    `,
  }),
};

export const CustomFooter = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```ts filename="Page.stories.ts" renderer="vue" language="ts-4-9" tabTitle="3"
// https://www.npmjs.com/package/vue-component-type-helpers
import type { ComponentProps } from 'vue-component-type-helpers';
import type { Meta, StoryObj } from '@storybook/vue3';

import Page from './Page.vue';

type PagePropsAndCustomArgs = ComponentProps<typeof Page> & { footer?: string };

const meta = {
  component: Page,
  render: (args) => ({
    components: { Page },
    setup() {
      return { args };
    },
    template: `
      <page v-bind="args">
        <template v-slot:footer>
          <footer v-if="args.footer" v-html="args.footer" />
        </template>
      </page>
    `,
  }),
} satisfies Meta<PagePropsAndCustomArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Primary = {
  args: {
    footer: 'Built with Storybook',
  },
} satisfies Story;
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="3"
// https://www.npmjs.com/package/vue-component-type-helpers
import type { ComponentProps } from 'vue-component-type-helpers';
import type { Meta, StoryObj } from '@storybook/vue3';

import Page from './Page.vue';

type PagePropsAndCustomArgs = ComponentProps<typeof Page> & { footer?: string };

const meta: Meta<PagePropsAndCustomArgs> = {
  component: Page,
  render: (args) => ({
    components: { Page },
    setup() {
      return { args };
    },
    template: `
      <page v-bind="args">
        <template v-slot:footer>
          <footer v-if="args.footer" v-html="args.footer" />
        </template>
      </page>
    `,
  }),
};
export default meta;

type Story = StoryObj<PagePropsAndCustomArgs>;

export const Primary: Story = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  title: 'Page',
  component: 'demo-page',
  render: ({ footer }) => html`
    <demo-page>
      <footer>${footer}</footer>
    </demo-page>
  `,
};

export const CustomFooter = {
  args: {
    footer: 'Built with Storybook',
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

type CustomArgs = { footer?: string };

const meta: Meta<CustomArgs> = {
  title: 'Page',
  component: 'demo-page',
  render: ({ footer }) => html`
    <demo-page>
      <footer>${footer}</footer>
    </demo-page>
  `,
};

export default meta;
type Story = StoryObj<CustomArgs>;

export const CustomFooter: Story = {
  args: {
    footer: 'Built with Storybook',
  },
};
```
