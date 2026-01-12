```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```js filename="Button.stories.js" renderer="html" language="js"
import { createButton } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: (args) => createButton(args),
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary = {
  render: (args) => createButton(args),
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary = {
  render: (args) => createButton(args),
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```ts filename="Button.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';
import { createButton, ButtonArgs } from './Button';

const meta: Meta<ButtonArgs> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
};

export default meta;
type Story = StoryObj<ButtonArgs>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args) => createButton(args),
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  render: (args) => createButton(args),
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  render: (args) => createButton(args),
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const Primary = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Primary = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<Story
  name="Primary"
  args={{
    backgroundColor: '#ff0',
    label: 'Button',
  }}
/>

<Story
  name="Secondary"
  args={{
    backgroundColor: '#ff0',
    label: '😄👍😍💯',
  }}
/>

<Story
  name="Tertiary"
  args={{
    backgroundColor:'#ff0',
    label: '📚📕📈🤓',
  }}
/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const Primary = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<Story
  name="Primary"
  args={{
    backgroundColor: '#ff0',
    label: 'Button',
  }}
/>

<Story
  name="Secondary"
  args={{
    backgroundColor: '#ff0',
    label: '😄👍😍💯',
  }}
/>

<Story
  name="Tertiary"
  args={{
    backgroundColor:'#ff0',
    label: '📚📕📈🤓',
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
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
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
};

export const Tertiary = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

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
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    background: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
};

export const Primary = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    ...Primary.args,
    label: '😄👍😍💯',
  },
};

export const Tertiary: Story = {
  args: {
    ...Primary.args,
    label: '📚📕📈🤓',
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = meta.story({
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    background: '#ff0',
    label: 'Button',
  },
});

export const Secondary = meta.story({
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Primary.input.args,
    label: '😄👍😍💯',
  },
});

export const Tertiary = meta.story({
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Primary.input.args,
    label: '📚📕📈🤓',
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = meta.story({
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
});

export const Secondary = meta.story({
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Primary.input.args,
    label: '😄👍😍💯',
  },
});

export const Tertiary = meta.story({
  render: (args) => ({
    components: { Button },
    setup() {
      return { args };
    },
    template: '<Button v-bind="args" />',
  }),
  args: {
    ...Primary.input.args,
    label: '📚📕📈🤓',
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    ...Primary.input.args,
    label: '😄👍😍💯',
  },
});

export const Tertiary = meta.story({
  args: {
    ...Primary.input.args,
    label: '📚📕📈🤓',
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  args: {
    backgroundColor: '#ff0',
    label: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    ...Primary.input.args,
    label: '😄👍😍💯',
  },
});

export const Tertiary = meta.story({
  args: {
    ...Primary.input.args,
    label: '📚📕📈🤓',
  },
});
```
