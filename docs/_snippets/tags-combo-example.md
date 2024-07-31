```ts filename="Button.stories.ts" renderer="angular" language="ts"
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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    template: `
      <div>
        <demo-button variant={1}>
        <demo-button variant={2}>
        {/* Etc... */}
      </div>
    `,
  }),
};
```

```jsx filename="Button.stories.jsx" renderer="react" language="js"
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

// Etc...

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1}>
      <Button variant={2}>
      {/* Etc... */}
    </>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1}>
      <Button variant={2}>
      {/* Etc... */}
    </>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1}>
      <Button variant={2}>
      {/* Etc... */}
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

// Etc...

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1}>
      <Button variant={2}>
      {/* Etc... */}
    </>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1}>
      <Button variant={2}>
      {/* Etc... */}
    </>
  ),
};
```

```tsx filename="Button.stories.tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => (
    <>
      <Button variant={1}>
      <Button variant={2}>
      {/* Etc... */}
    </>
  ),
};
```

```js filename="Button.stories.js" renderer="vue" language="js"
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

// Etc...

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button variant={1}>
        <Button variant={2}>
        {/* Etc... */}
      </div>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button variant={1}>
        <Button variant={2}>
        {/* Etc... */}
      </div>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => ({
    components: { Button },
    template: `
      <div>
        <Button variant={1}>
        <Button variant={2}>
        {/* Etc... */}
      </div>
    `,
  }),
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="js"
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

// Etc...

export const Combo = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => html`
    <div>
      <demo-button variant="1">
      <demo-button variant="2">
      {/* Etc... */}
    </div>
  `,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';
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

// Etc...

export const Combo: Story = {
  // 👇 This story should not be tested, but will appear in the sidebar and docs page
  tags: ['!test'],
  render: () => html`
    <div>
      <demo-button variant="1">
      <demo-button variant="2">
      {/* Etc... */}
    </div>
  `,
};
```

