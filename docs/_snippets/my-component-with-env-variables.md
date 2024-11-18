```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const ExampleStory: Story = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: process.env.STORYBOOK_DATA_KEY
  }}
/>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const ExampleStory = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const ExampleStory = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: process.env.STORYBOOK_DATA_KEY
  }}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: process.env.STORYBOOK_DATA_KEY
  }}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const ExampleStory: Story = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const ExampleStory: Story = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
};

export const ExampleStory = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const ExampleStory: Story = {
  args: {
    propertyA: process.env.STORYBOOK_DATA_KEY,
  },
};
```
