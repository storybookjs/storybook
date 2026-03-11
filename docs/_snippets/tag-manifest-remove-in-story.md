```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

// 👇 This story will be included in the manifest because it has the implicit 'manifest' tag
export const Basic = {};

export const ForInstructionOnly = {
  tags: ['!manifest'], // 👈 Remove the 'manifest' tag to exclude this story from the manifests
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will be included in the manifest because it has the implicit 'manifest' tag
export const Basic = {};

export const ForInstructionOnly = {
  tags: ['!manifest'], // 👈 Remove the 'manifest' tag to exclude this story from the manifests
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

// 👇 This story will be included in the manifest because it has the implicit 'manifest' tag
export const Basic = meta.story();

export const ForInstructionOnly = meta.story({
  tags: ['!manifest'], // 👈 Remove the 'manifest' tag to exclude this story from the manifests
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

// 👇 This story will be included in the manifest because it has the implicit 'manifest' tag
export const Basic = meta.story();

export const ForInstructionOnly = meta.story({
  tags: ['!manifest'], // 👈 Remove the 'manifest' tag to exclude this story from the manifests
});
```
