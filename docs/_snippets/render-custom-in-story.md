```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { type Meta, type StoryObj, argsToTemplate } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const PrimaryInAlert: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => ({
    props: args,
    template: `
      <demo-alert>
        Alert text
        <demo-button ${argsToTemplate(args)}></demo-button>
      </demo-alert>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { argsToTemplate } from '@storybook/angular';

import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  component: Button,
});

export const PrimaryInAlert = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => ({
    props: args,
    template: `
      <demo-alert>
        Alert text
        <demo-button ${argsToTemplate(args)}></demo-button>
      </demo-alert>
    `,
  }),
});
```

```jsx filename="Button.stories.jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Alert } from './Alert';
import { Button } from './Button';

export default {
  component: Button,
};

export const PrimaryInAlert = {
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => (
    <Alert>
      Alert text
      <Button {...args} />
    </Alert>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { Meta, StoryObj } from '@storybook/your-framework';

import { Alert } from './Alert';
import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const PrimaryInAlert: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => (
    <Alert>
      Alert text
      <Button {...args} />
    </Alert>
  ),
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import Alert from './Alert.vue';
import Button from './Button.vue';

export default {
  component: Button,
};

export const PrimaryInAlert = {
  render: (args) => ({
    components: { Alert, Button },
    setup() {
      return { args };
    },
    template: '<Alert><Button v-bind="args" /></Alert>',
  }),
  args: {
    primary: true,
    label: 'Button',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Alert from './Alert.vue';
import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryInAlert: Story = {
  render: (args) => ({
    components: { Alert, Button },
    setup() {
      return { args };
    },
    template: '<Alert><Button v-bind="args" /></Alert>',
  }),
  args: {
    primary: true,
    label: 'Button',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Alert from './Alert.vue';
import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

export const PrimaryInAlert = meta.story({
  render: (args) => ({
    components: { Alert, Button },
    setup() {
      return { args };
    },
    template: '<Alert><Button v-bind="args" /></Alert>',
  }),
  args: {
    primary: true,
    label: 'Button',
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Alert from './Alert.vue';
import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

export const PrimaryInAlert = meta.story({
  render: (args) => ({
    components: { Alert, Button },
    setup() {
      return { args };
    },
    template: '<Alert><Button v-bind="args" /></Alert>',
  }),
  args: {
    primary: true,
    label: 'Button',
  },
});
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import html from 'lit';

export default {
  component: 'demo-button',
};

export const PrimaryInAlert = {
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => html`
    <demo-alert>
      Alert text
      <demo-button ?primary=${args.primary} label=${args.label}></demo-button>
    </demo-alert>
  `,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import html from 'lit';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const PrimaryInAlert: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => html`
    <demo-alert>
      Alert text
      <demo-button ?primary=${args.primary} label=${args.label}></demo-button>
    </demo-alert>
  `,
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import html from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
});

export const PrimaryInAlert = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => html`
    <demo-alert>
      Alert text
      <demo-button ?primary=${args.primary} label=${args.label}></demo-button>
    </demo-alert>
  `,
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import html from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
});

export const PrimaryInAlert = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => html`
    <demo-alert>
      Alert text
      <demo-button ?primary=${args.primary} label=${args.label}></demo-button>
    </demo-alert>
  `,
});
```

```tsx filename="Button.stories.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Alert } from './Alert';
import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const PrimaryInAlert = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => (
    <Alert>
      Alert text
      <Button {...args} />
    </Alert>
  ),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="Button.stories.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Alert } from './Alert';
import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const PrimaryInAlert = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
  render: (args) => (
    <Alert>
      Alert text
      <Button {...args} />
    </Alert>
  ),
});
```
