```js filename="src/Widget.demo.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  title: 'Example/Widget',
};

export const Default = {
  args: { label: 'Custom filename' },
};
```

```ts filename="src/Widget.demo.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

const meta: Meta<{ label: string }> = {
  title: 'Example/Widget',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Custom filename' },
};
```

```ts filename="src/Widget.demo.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```

```js filename="src/Widget.demo.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```

```ts filename="src/Widget.demo.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```

```js filename="src/Widget.demo.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```

```ts filename="src/Widget.demo.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```

```ts filename="src/Widget.demo.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```

```js filename="src/Widget.demo.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  title: 'Example/Widget',
});

export const Default = meta.story({
  args: { label: 'Custom filename' },
});
```
