```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    props: {
      label: 'Button',
      backgroundColor: '#ff0',
    },
  }),
};

export const Secondary: Story = {
  render: () => ({
    props: {
      label: '😄👍😍💯',
      backgroundColor: '#ff0',
    },
  }),
};

export const Tertiary: Story = {
  render: () => ({
    props: {
      label: '📚📕📈🤓',
      backgroundColor: '#ff0',
    },
  }),
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
  render: (args) => createButton({ backgroundColor: '#ff0', label: 'Button' }),
};

export const Secondary = {
  render: (args) => createButton({ backgroundColor: '#ff0', label: '😄👍😍💯' }),
};

export const Tertiary = {
  render: (args) => createButton({ backgroundColor: '#ff0', label: '📚📕📈🤓' }),
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
  render: (args) => createButton({ backgroundColor: '#ff0', label: 'Button' }),
};

export const Secondary: Story = {
  render: (args) => createButton({ backgroundColor: '#ff0', label: '😄👍😍💯' }),
};

export const Tertiary: Story = {
  render: (args) => createButton({ backgroundColor: '#ff0', label: '📚📕📈🤓' }),
};
```

```ts filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => <Button backgroundColor="#ff0" label="Button" />,
};

export const Secondary = {
  render: () => <Button backgroundColor="#ff0" label="😄👍😍💯" />,
};

export const Tertiary = {
  render: () => <Button backgroundColor="#ff0" label="📚📕📈🤓" />,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

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
  render: () => <Button backgroundColor="#ff0" label="Button" />,
};

export const Secondary: Story = {
  render: () => <Button backgroundColor="#ff0" label="😄👍😍💯" />,
};

export const Tertiary: Story = {
  render: () => <Button backgroundColor="#ff0" label="📚📕📈🤓" />,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

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
  render: () => <Button backgroundColor="#ff0" label="Button" />,
};

export const Secondary: Story = {
  render: () => <Button backgroundColor="#ff0" label="😄👍😍💯" />,
};

export const Tertiary: Story = {
  render: () => <Button backgroundColor="#ff0" label="📚📕📈🤓" />,
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

<Story name="Primary">
  <Button backgroundColor="#ff0" label="Button" />
</Story>

<Story name="Secondary">
  <Button backgroundColor="#ff0" label="😄👍😍💯" />
</Story>

<Story name="Tertiary">
  <Button backgroundColor="#ff0" label="📚📕📈🤓" />
</Story>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

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
    Component: Button,
    props: {
      backgroundColor: '#ff0',
      label: 'Button',
    },
  }),
};

export const Secondary = {
  render: () => ({
    Component: Button,
    props: {
      backgroundColor: '#ff0',
      label: '😄👍😍💯',
    },
  }),
};

export const Tertiary = {
  render: () => ({
    Component: Button,
    props: {
      backgroundColor: '#ff0',
      label: '📚📕📈🤓',
    },
  }),
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

<Story name="Primary">
  <Button backgroundColor="#ff0" label="Button" />
</Story>

<Story name="Secondary">
  <Button backgroundColor="#ff0" label="😄👍😍💯" />
</Story>

<Story name="Tertiary">
  <Button backgroundColor="#ff0" label="📚📕📈🤓" />
</Story>
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/svelte/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => ({
    Component: Button,
    props: {
      backgroundColor: '#ff0',
      label: 'Button',
    },
  }),
};

export const Secondary: Story = {
  render: () => ({
    Component: Button,
    props: {
      backgroundColor: '#ff0',
      label: '😄👍😍💯',
    },
  }),
};

export const Tertiary: Story = {
  render: () => ({
    Component: Button,
    props: {
      backgroundColor: '#ff0',
      label: '📚📕📈🤓',
    },
  }),
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
    template: '<Button backgroundColor="#ff0" label="Button" />',
  }),
};

export const Secondary = {
  render: () => ({
    components: { Button },
    template: '<Button backgroundColor="#ff0" label="😄👍😍💯" />',
  }),
};

export const Tertiary = {
  render: () => ({
    components: { Button },
    template: '<Button backgroundColor="#ff0" label="📚📕📈🤓" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

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
    template: '<Button backgroundColor="#ff0" label="Button" />',
  }),
};

export const Secondary: Story = {
  render: () => ({
    components: { Button },
    template: '<Button backgroundColor="#ff0" label="😄👍😍💯" />',
  }),
};

export const Tertiary: Story = {
  render: () => ({
    components: { Button },
    template: '<Button backgroundColor="#ff0" label="📚📕📈🤓" />',
  }),
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-button',
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: () => html`<demo-button .backgroundColor="#ff0" .label="Button"></demo-button>`,
};

export const Secondary = {
  render: () => html`<demo-button .backgroundColor="#ff0" .label="😄👍😍💯"></demo-button>`,
};

export const Tertiary = {
  render: () => html`<demo-button .backgroundColor="#ff0" .label="📚📕📈🤓"></demo-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: () => html`<demo-button .backgroundColor="#ff0" .label="Button"></demo-button>`,
};

export const Secondary: Story = {
  render: () => html`<demo-button .backgroundColor="#ff0" .label="😄👍😍💯"></demo-button>`,
};

export const Tertiary: Story = {
  render: () => html`<demo-button .backgroundColor="#ff0" .label="📚📕📈🤓"></demo-button>`,
};
```
