```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => ({
    template: `<app-button>hello</<app-button>`,
  }),
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import React from 'react';

import { Button } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => <Button>Hello</Button>,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => <Button>Hello</Button>,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export const Basic = {};
```

```html renderer="svelte" language="ts" tabTitle="native-format"
{/* Button.stories.svelte */}

<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';
</script>

<Meta title="Button" component={Button} parameters={{ myAddon: { data: 'this data is passed to the
addon', }, }} />

<template let:args>
  <button {...args} />
</template>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => ({
    components: { Button },
    template: '<Button label="Hello" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => ({
    components: { Button },
    template: '<Button label="Hello" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => ({
    components: { Button },
    template: '<Button label="Hello" />',
  }),
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  title: 'Button',
  component: 'custom-button',
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic = {
  render: () => html`<custom-button label="Hello"></custom-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  title: 'Button',
  component: 'custom-button',
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Basic: Story = {
  render: () => html`<custom-button label="Hello"></custom-button>`,
};
```

