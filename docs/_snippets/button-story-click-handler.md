```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { action } from 'storybook/actions';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Text: Story = {
  render: () => ({
    props: {
      label: 'Button',
      onClick: action('clicked'),
    },
    template: `<storybook-button [label]="label" (onClick)="onClick($event)"></storybook-button>`,
  }),
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { action } from 'storybook/actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { action } from 'storybook/actions';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { action } from 'storybook/actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { action } from 'storybook/actions';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import { action } from 'storybook/actions';

import Button from './Button.svelte';

export default {
  component: Button,
};

export const Text = {
  render: () => ({
    Component: Button,
    props: {
      label: 'Hello',
    },
    on: {
      click: action('clicked'),
    },
  }),
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import { action } from 'storybook/actions';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: (args) => ({
    Component: Button,
    props: args,
  }),
  args: {
    primary: true,
    label: 'Button',
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import { action } from 'storybook/actions';

import Button from './Button.vue';

export default {
  component: Button,
};

export const Text = {
  render: () => ({
    components: { Button },
    setup() {
      return {
        onClick: action('clicked'),
      };
    },
    template: '<Button label="Hello" @click="onClick" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { action } from 'storybook/actions';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  render: () => ({
    components: { Button },
    setup() {
      return {
        onClick: action('clicked'),
      };
    },
    template: '<Button label="Hello" @click="onClick" />',
  }),
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

import { action } from 'storybook/actions';

export default {
  component: 'custom-button',
};

export const Text = {
  render: () => html`<custom-button label="Hello" @click=${action('clicked')}></custom-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { action } from 'storybook/actions';

import { html } from 'lit';

const meta: Meta = {
  component: 'custom-button',
};

export default meta;
type Story = StoryObj;

export const Text: Story = {
  render: () => html`<custom-button label="Hello" @click=${action('clicked')}></custom-button>`,
};
```
