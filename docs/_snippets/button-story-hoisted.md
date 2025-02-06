```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button as ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
};

export default meta;
type Story = StoryObj<ButtonComponent>;

// This is the only named export in the file, and it matches the component name
export const Button: Story = {};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button as ButtonComponent } from './Button';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
};

// This is the only named export in the file, and it matches the component name
export const Button = {};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button as ButtonComponent } from './Button';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story({});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button as ButtonComponent } from './Button';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
} satisfies Meta<typeof ButtonComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is the only named export in the file, and it matches the component name
export const Button: Story = {};
```

```ts filename="Button.stories.js|jsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button as ButtonComponent } from './Button';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story({});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button as ButtonComponent } from './Button';

const meta: Meta<typeof ButtonComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
};

export default meta;
type Story = StoryObj<typeof ButtonComponent>;

// This is the only named export in the file, and it matches the component name
export const Button: Story = {};
```

```ts filename="Button.stories.js|jsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button as ButtonComponent } from './Button';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story({});
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'Design System/Atoms/Button',
  component: 'demo-button',
};

// This is the only named export in the file, and it matches the component name
export const Button = {};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/your-framework';

const meta: Meta = {
  title: 'Design System/Atoms/Button',
  component: 'demo-component',
};

export default meta;
type Story = StoryObj;

// This is the only named export in the file, and it matches the component name
export const Button: Story = {};
```
