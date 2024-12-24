```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

import { action } from '@storybook/addon-actions';

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
import { action } from '@storybook/addon-actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { action } from '@storybook/addon-actions';

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

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { action } from '@storybook/addon-actions';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Basic: Story = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { action } from '@storybook/addon-actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { action } from '@storybook/addon-actions';

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

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { action } from '@storybook/addon-actions';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Basic: Story = {
  render: () => <Button label="Hello" onClick={action('clicked')} />,
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import { action } from '@storybook/addon-actions';

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

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';
import { action } from '@storybook/addon-actions';

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

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';
import { action } from '@storybook/addon-actions';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
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

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

import { action } from '@storybook/addon-actions';

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

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

import { action } from '@storybook/addon-actions';

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

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

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

import { action } from '@storybook/addon-actions';

export default {
  component: 'custom-button',
};

export const Text = {
  render: () => html`<custom-button label="Hello" @click=${action('clicked')}></custom-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';
import { action } from '@storybook/addon-actions';

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
