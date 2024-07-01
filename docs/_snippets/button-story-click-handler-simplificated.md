```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Text: Story = {
  args: {},
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
}

export const Text = {
  args: {...},
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

export const Text: Story = {
  args: {},
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

export const Text: Story = {
  args: {},
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
}

export const Text = {
  args: {...},
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

export const Text: Story = {
  args: {},
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

export const Text: Story = {
  args: {},
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const Text = {
  args: {...},
};
```

```html renderer="svelte" language="ts" tabTitle="native-format"
{/* Button.stories.svelte */}

<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';
  import Button from './Button.svelte';
</script>

{/*
  See https://storybook.js.org/docs/essentials/actions#action-argtype-annotation
  to learn how to set up argTypes for actions
*/}

<Meta title="Button" component={Button} argTypes={{ onClick: { action: "onClick" }, }} />

<template let:args>
  <button {...args} on:click="{args.onClick}" />
</template>

<Story name="Text" args={{ label: 'Hello' }}/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {...},
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

export const Text: Story = {
  args: {...},
};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
  argTypes: {
    onClick: {},
  },
};

export const Text = {
  args: {},
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  title: 'Button',
  component: Button,
  argTypes: {
    onClick: {},
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {},
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  title: 'Button',
  component: Button,
  argTypes: {
    onClick: {},
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Text: Story = {
  args: {},
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'custom-button',
  argTypes: {
    onClick: { action: 'onClick' },
  },
};

export const Text = {
  args: {...},
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'custom-button',
  argTypes: {
    onClick: { action: 'onClick' },
  },
};

export default meta;
type Story = StoryObj;

export const Text: Story = {
  args: {},
};
```

