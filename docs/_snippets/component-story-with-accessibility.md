```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button.component';

const meta: Meta<Button> = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<Button>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};
// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

// This is an accessible story
export const Accessible = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

// This is an accessible story
export const Accessible = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

// This is an accessible story
export const Accessible = {
  render: (args) => ({
    Component: Button,
    props: args,
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible = {
  render: (args) => ({
    Component: Button,
    props: args,
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="2"
import Button from './Button.vue';

export default {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

// This is an accessible story
export const Accessible = {
  render: (args, { argTypes }) => ({
    components: { Button },
    props: Object.keys(argTypes),
    template: '<Button v-bind="$props" v-on="$props" />',
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible = {
  render: (args, { argTypes }) => ({
    components: { Button },
    props: Object.keys(argTypes),
    template: '<Button v-bind="$props" v-on="$props" />',
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9" tabTitle="2"
import type { Meta, StoryObj } from '@storybook/vue';

import Button from './Button.vue';

const meta = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is an accessible story
export const Accessible: Story = {
  render: (args, { argTypes }) => ({
    components: { Button },
    props: Object.keys(argTypes),
    template: '<Button v-bind="$props" v-on="$props" />',
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};
// This is not
export const Inaccessible: Story = {
  render: (args, { argTypes }) => ({
    components: { Button },
    props: Object.keys(argTypes),
    template: '<Button v-bind="$props" v-on="$props" />',
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="2"
import type { Meta, StoryObj } from '@storybook/vue';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// This is an accessible story
export const Accessible: Story = {
  render: (args, { argTypes }) => ({
    components: { Button },
    props: Object.keys(argTypes),
    template: '<Button v-bind="$props" v-on="$props" />',
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};
// This is not
export const Inaccessible: Story = {
  render: (args, { argTypes }) => ({
    components: { Button },
    props: Object.keys(argTypes),
    template: '<Button v-bind="$props" v-on="$props" />',
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="3"
import Button from './Button.vue';

export default {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

// This is an accessible story
export const Accessible = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is an accessible story
export const Accessible: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};
// This is not
export const Inaccessible: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// This is an accessible story
export const Accessible: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    primary: false,
    label: 'Button',
  },
};
// This is not
export const Inaccessible: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'custom-button',
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

// This is an accessible story
export const Accessible = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'custom-button',
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj;

// This is an accessible story
export const Accessible: Story = {
  args: {
    primary: false,
    label: 'Button',
  },
};

// This is not
export const Inaccessible: Story = {
  args: {
    ...Accessible.args,
    backgroundColor: 'red',
  },
};
```
