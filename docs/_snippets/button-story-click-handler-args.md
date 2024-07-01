```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';

import { action } from '@storybook/addon-actions';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Text: Story = {
  render: (args) => ({
    props: args,
    // The argsToTemplate helper function converts the args to property and event bindings.
    // You could also write the template in plain HTML and bind to the component's inputs and outputs yourself:
    // <storybook-button ["label"]="label" (onClick)="onClick($event)">
    // We don't recommend the latter since it can conflict with how Storybook applies arguments via its controls addon.
    // Binding to the component's inputs and outputs yourself will conflict with default values set inside the component's class.
    // In edge-case scenarios, you may need to define the template yourself, though.
    template: `<storybook-button ${argsToTemplate(args)}></storybook-button>`,
  }),
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { action } from '@storybook/addon-actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
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

export const Text = {
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
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

export const Text = {
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { action } from '@storybook/addon-actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
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

export const Text = {
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
};
```

```ts filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { action } from '@storybook/addon-actions';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Text = {
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

import { action } from '@storybook/addon-actions';

export default {
  component: Button,
};

export const Text = {
  render: ({ label, click }) => ({
    Component: Button,
    props: {
      label,
    },
    on: {
      click,
    },
  }),
  args: {
    label: 'Hello',
    click: action('clicked'),
  },
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
  render: ({ label, click }) => ({
    Component: Button,
    props: {
      label,
    },
    on: {
      click,
    },
  }),
  args: {
    label: 'Hello',
    click: action('clicked'),
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
  render: ({ label, click }) => ({
    Component: Button,
    props: {
      label,
    },
    on: {
      click,
    },
  }),
  args: {
    label: 'Hello',
    click: action('clicked'),
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="3"
import Button from './Button.vue';

import { action } from '@storybook/addon-actions';

export default {
  component: Button,
};

export const Text = {
  render: (args) => ({
    components: { Button },
    setup() {
      return {
        ...args,
        onClick: action('clicked'),
      };
    },
    template: '<Button @click="onClick" :label="label" />',
  }),
  args: {
    label: 'Hello',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

import { action } from '@storybook/addon-actions';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return {
        ...args,
        onClick: action('clicked'),
      };
    },
    template: '<Button @click="onClick" :label="label" />',
  }),
  args: {
    label: 'Hello',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return {
        ...args,
        onClick: action('clicked'),
      };
    },
    template: '<Button @click="onClick" :label="label" />',
  }),
  args: {
    label: 'Hello',
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

import { action } from '@storybook/addon-actions';

export default {
  component: 'custom-button',
};

export const Text = {
  render: ({ label, onClick }) =>
    html`<custom-button label="${label}" @click=${onClick}></custom-button>`,
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
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
  render: ({ label, onClick }) =>
    html`<custom-button label="${label}" @click=${onClick}></custom-button>`,
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
};
```

