```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<Button> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Simple: Story = {
  name: 'So simple!',
  // ...
};
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent.component';

const meta = preview.meta({
  component: MyComponent,
});

export const Simple = meta.story({
  name: 'So simple!',
  // ...
});
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Simple = {
  name: 'So simple!',
  // ...
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simple: Story = {
  name: 'So simple!',
  // ...
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  component: 'my-component',
};

export const Simple = {
  name: 'So simple!',
  // ...
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const Simple: Story = {
  name: 'So simple!',
  // ...
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Simple = meta.story({
  name: 'So simple!',
  // ...
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Simple = meta.story({
  name: 'So simple!',
  // ...
});
```
