```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
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

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button as ButtonComponent } from './button.component';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story();
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

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
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

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  title: 'Design System/Atoms/Button',
  component: 'demo-button',
};

// This is the only named export in the file, and it matches the component name
export const Button = {};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Design System/Atoms/Button',
  component: 'demo-component',
};

export default meta;
type Story = StoryObj;

// This is the only named export in the file, and it matches the component name
export const Button: Story = {};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Design System/Atoms/Button',
  component: 'demo-button',
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story();
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Design System/Atoms/Button',
  component: 'demo-component',
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story();
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

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
export const Button = meta.story();
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

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
export const Button = meta.story();
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import ButtonComponent from './Button.vue';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story();
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import ButtonComponent from './Button.vue';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Button',
  component: ButtonComponent,
});

// This is the only named export in the file, and it matches the component name
export const Button = meta.story();
```
