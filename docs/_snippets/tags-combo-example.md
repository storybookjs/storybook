```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button';

const meta: Meta<Button> = {
  component: Button,
};
export default meta;

type Story = StoryObj<Button>;

export const Variant1: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    template: `
      <div>
        <demo-button [variant]="1"></demo-button>
        <demo-button [variant]="2"></demo-button>
      </div>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    template: `
      <div>
        <demo-button [variant]="1"></demo-button>
        <demo-button [variant]="2"></demo-button>
      </div>
    `,
  }),
});
```

```jsx filename="Button.stories.jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const Variant1 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1} />
      <Button variant={2} />
    </>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Variant1: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1} />
      <Button variant={2} />
    </>
  ),
};
```

```jsx filename="Button.stories.jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Variant1 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1} />
      <Button variant={2} />
    </>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Variant1: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1} />
      <Button variant={2} />
    </>
  ),
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { Button } from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<!-- 👇 This story will not appear in Storybook's sidebar or docs page -->
<Story
  name="Variant1"
  tags={['!dev', '!autodocs']}
  args={{ variant: 1 }}
/>

<!-- 👇 This story will not appear in Storybook's sidebar or docs page -->
<Story
  name="Variant2"
  tags={['!dev', '!autodocs']}
  args={{ variant: 2 }}
/>

<!-- 👇 This story should not be tested, but will appear in the sidebar and docs page -->
<Story name="Combo" tags={['!test']}>
  <Button variant={1}>
  <Button variant={2}>
</Story>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { Button } from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<!-- 👇 This story will not appear in Storybook's sidebar or docs page -->
<Story
  name="Variant1"
  tags={['!dev', '!autodocs']}
  args={{ variant: 1 }}
/>

<!-- 👇 This story will not appear in Storybook's sidebar or docs page -->
<Story
  name="Variant2"
  tags={['!dev', '!autodocs']}
  args={{ variant: 2 }}
/>

<!-- 👇 This story should not be tested, but will appear in the sidebar and docs page -->
<Story name="Combo" tags={['!test']}>
  <Button variant={1} />
  <Button variant={2} />
</Story>
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const Variant1 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button :variant="1" />
        <Button :variant="2" />
      </div>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Variant1: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button :variant="1" />
        <Button :variant="2" />
      </div>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button :variant="1" />
        <Button :variant="2" />
      </div>
    `,
  }),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button :variant="1" />
        <Button :variant="2" />
      </div>
    `,
  }),
});
```

```ts filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import { html } from 'lit';

export default {
  title: 'Button',
  component: 'demo-button',
};

export const Variant1 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2 = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => html`
    <div>
      <demo-button variant="1" />
      <demo-button variant="2" />
    </div>
  `,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
};
export default meta;

type Story = StoryObj;

export const Variant1: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
};

export const Variant2: Story = {
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
};

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => html`
    <div>
      <demo-button variant="1" />
      <demo-button variant="2" />
    </div>
  `,
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Button',
  component: 'demo-button',
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => html`
    <div>
      <demo-button variant="1" />
      <demo-button variant="2" />
    </div>
  `,
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Button',
  component: 'demo-button',
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => html`
    <div>
      <demo-button variant="1" />
      <demo-button variant="2" />
    </div>
  `,
});
```

```tsx filename="Button.stories.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1} />
      <Button variant={2} />
    </>
  ),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="Button.stories.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Variant1 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 1 },
});

export const Variant2 = meta.story({
  // 👇 This story will not appear in Storybook's sidebar or docs page
  tags: ['!dev', '!autodocs'],
  args: { variant: 2 },
});

export const Combo = meta.story({
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1} />
      <Button variant={2} />
    </>
  ),
});
```
