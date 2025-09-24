```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';

import { action } from 'storybook/actions';

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
    // We don't recommend the latter since it can conflict with how Storybook applies arguments via the Controls panel.
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

```jsx filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { action } from 'storybook/actions';

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

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { action } from 'storybook/actions';

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

```jsx filename="Button.stories.js|jsx" renderer="solid" language="js"
import { action } from 'storybook/actions';

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

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { action } from 'storybook/actions';

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

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

import { action } from 'storybook/actions';

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

```js filename="Button.stories.js" renderer="vue" language="js"
import { action } from 'storybook/actions';

import Button from './Button.vue';

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

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { action } from 'storybook/actions';

import Button from './Button.vue';

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

```js filename="Button.stories.js" renderer="web-components" language="js"
import { action } from 'storybook/actions';

import { html } from 'lit';

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
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { action } from 'storybook/actions';

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

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { action } from 'storybook/actions';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Text = meta.story({
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { action } from 'storybook/actions';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Text = meta.story({
  args: {
    label: 'Hello',
    onClick: action('clicked'),
  },
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
});
```
