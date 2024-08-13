```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    props: {
      label: 'Button',
      primary: true,
    },
  }),
};
```

```js filename="Button.stories.js" renderer="html" language="js"
export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => {
    const btn = document.createElement('button');
    btn.innerText = 'Button';

    btn.className = [
      'storybook-button',
      'storybook-button--medium',
      'storybook-button--primary',
    ].join(' ');

    return btn;
  },
};
```

```ts filename="Button.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
};

export default meta;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: StoryObj = {
  render: () => {
    const btn = document.createElement('button');
    btn.innerText = 'Button';

    btn.className = [
      'storybook-button',
      'storybook-button--medium',
      'storybook-button--primary',
    ].join(' ');

    return btn;
  },
};
```

```js filename="Button.stories.js|jsx" renderer="preact" language="js"
/** @jsx h */
import { h } from 'preact';

import { Button } from './Button';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => <Button primary label="Button" />,
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => <Button primary label="Button" />,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => <Button primary label="Button" />,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => <Button primary label="Button" />,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => <Button primary label="Button" />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => <Button primary label="Button" />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => <Button primary label="Button" />,
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => ({
    Component: Button,
    props: {
      primary: true,
      label: 'Button',
    },
  }),
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    Component: Button,
    props: {
      primary: true,
      label: 'Button',
    },
  }),
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    Component: Button,
    props: {
      primary: true,
      label: 'Button',
    },
  }),
};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => ({
    components: { Button },
    template: '<Button primary label="Button" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
// Replace vue3 with vue if you are using Storybook for Vue 2
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    components: { Button },
    template: '<Button primary label="Button" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
// Replace vue3 with vue if you are using Storybook for Vue 2
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    components: { Button },
    template: '<Button primary label="Button" />',
  }),
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-button',
};

export const Primary = {
  render: () => html`<demo-button primary></demo-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  render: () => html`<demo-button primary></demo-button>`,
};
```
