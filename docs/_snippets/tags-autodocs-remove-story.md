```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button.component';

const meta: Meta<Button> = {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<Button>;

export const UndocumentedStory: Story = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button.component';

const meta = preview.meta({
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Enables auto-generated documentation for this component and includes all stories in this file
    tags: ['autodocs'],
  });
</script>

<!--👇 Removes this story from auto-generated documentation -->
<Story name="UndocumentedStory" tags={['!autodocs']} />
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import Button from './Button.svelte';

export default {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};

export const UndocumentedStory = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```js filename="Button.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};

export const UndocumentedStory = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Enables auto-generated documentation for this component and includes all stories in this file
    tags: ['autodocs'],
  });
</script>

<!--👇 Removes this story from auto-generated documentation -->
<Story name="UndocumentedStory" tags={['!autodocs']} />
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const UndocumentedStory: Story = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const UndocumentedStory: Story = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  title: 'Button',
  component: 'demo-button',
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};

export const UndocumentedStory = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj;

export const UndocumentedStory: Story = {
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  //👇 Enables auto-generated documentation for this component and includes all stories in this file
  tags: ['autodocs'],
});

export const UndocumentedStory = meta.story({
  // 👇 Removes this story from auto-generated documentation
  tags: ['!autodocs'],
});
```
