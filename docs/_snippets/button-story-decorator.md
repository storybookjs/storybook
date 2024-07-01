```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { componentWrapperDecorator, moduleMetadata } from '@storybook/angular';

import { Button } from './button.component';

import { Parent } from './parent.component'; // Parent contains ng-content

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = {
  decorators: [componentWrapperDecorator((story) => `<div style="margin: 3em">${story}</div>`)],
};

export const InsideParent: Story = {
  decorators: [
    moduleMetadata({
      declarations: [Parent],
    }),
    componentWrapperDecorator(Parent),
  ],
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Primary = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
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

export const Primary: Story = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
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

export const Primary: Story = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </div>
    ),
  ],
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Primary = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};
```

```ts filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};
```

```ts filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    ),
  ],
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';
import MarginDecorator from './MarginDecorator.svelte';

export default {
  component: Button,
};

export const Primary = {
  decorators: [() => MarginDecorator],
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  decorators: [() => MarginDecorator],
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
import { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  decorators: [() => MarginDecorator],
};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => ({
    components: { Button },
    template: '<Button primary label="Hello World" />',
  }),
  decorators: [() => ({ template: '<div style="margin: 3em;"><story /></div>' })],
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    components: { Button },
    template: '<Button primary label="Hello World" />',
  }),
  decorators: [() => ({ template: '<div style="margin: 3em;"><story /></div>' })],
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    components: { Button },
    template: '<Button primary label="Hello World" />',
  }),
  decorators: [() => ({ template: '<div style="margin: 3em;"><story /></div>' })],
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-button',
};

export const Primary = {
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  decorators: [(story) => html`<div style="margin: 3em">${story()}</div>`],
};
```

