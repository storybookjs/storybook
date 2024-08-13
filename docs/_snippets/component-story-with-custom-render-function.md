```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata, argsToTemplate } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { Layout } from './Layout.component';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  decorators: [
    moduleMetadata({
      declarations: [Layout],
      imports: [CommonModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<MyComponent>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-layout>
        <header>
          <h1>Example</h1>
        </header>
        <article>
          <app-my-component ${argsToTemplate(args)}></app-my-component>
        </article>
      </app-layout>
    `,
  }),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="preact" language="js"
/** @jsx h */
import { h } from 'preact';

import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

// This story uses a render function to fully control how the component renders.
export const Example = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

// This story uses a render function to fully control how the component renders.
export const Example = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

export default {
  title: 'MyComponent',
  component: MyComponent,
};

// This story uses a render function to fully control how the component renders.
export const Example = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Layout } from './Layout';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => (
    <Layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <MyComponent />
      </article>
    </Layout>
  ),
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import Layout from './Layout.vue';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

// This story uses a render function to fully control how the component renders.
export const Example = {
  render: () => ({
    components: { Layout, MyComponent },
    template: `
      <Layout>
        <header>
          <h1>Example</h1>
        </header>
        <article>
          <MyComponent />
        </article>
      </Layout>
    `,
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
// Replace vue3 with vue if you are using Storybook for Vue 2
import type { Meta, StoryObj } from '@storybook/vue3';

import Layout from './Layout.vue';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => ({
    components: { Layout, MyComponent },
    template: `
      <Layout>
        <header>
          <h1>Example</h1>
        </header>
        <article>
          <MyComponent />
        </article>
      </Layout>
    `,
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
// Replace vue3 with vue if you are using Storybook for Vue 2
import type { Meta, StoryObj } from '@storybook/vue3';

import Layout from './Layout.vue';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => ({
    components: { Layout, MyComponent },
    template: `
      <Layout>
        <header>
          <h1>Example</h1>
        </header>
        <article>
          <MyComponent />
        </article>
      </Layout>
    `,
  }),
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'my-component',
};

// This story uses a render function to fully control how the component renders.
export const Example = {
  render: () => html`
    <layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <my-component />
      </article>
    </layout>
  `,
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

// This story uses a render function to fully control how the component renders.
export const Example: Story = {
  render: () => html`
    <layout>
      <header>
        <h1>Example</h1>
      </header>
      <article>
        <my-component />
      </article>
    </layout>
  `,
};
```
