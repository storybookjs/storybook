```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button.component';

const meta: Meta<Button> = {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export default meta;
type Story = StoryObj<Button>;

export const ExperimentalFeatureStory: Story = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // 👇 Applies to all stories in this file
    tags: ['stable'],
  });
</script>

<!-- 👇 For this particular story, remove the inherited stable` tag and apply the `experimental` tag -->
<Story name="ExperimentalFeatureStory" tags={['!stable', 'experimental']} />
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export const ExperimentalFeatureStory = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export const ExperimentalFeatureStory = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // 👇 Applies to all stories in this file
    tags: ['stable'],
  });
</script>

<!-- 👇 For this particular story, remove the inherited stable` tag and apply the `experimental` tag -->
<Story name="ExperimentalFeatureStory" tags={['!stable', 'experimental']} />
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExperimentalFeatureStory: Story = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ExperimentalFeatureStory: Story = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // 👇 Applies to all stories in this file
    tags: ['stable'],
  });
</script>

<!-- 👇 For this particular story, remove the inherited stable` tag and apply the `experimental` tag -->
<Story name="ExperimentalFeatureStory" tags={['!stable', 'experimental']} />
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const ExperimentalFeatureStory: Story = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const ExperimentalFeatureStory: Story = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'Button',
  component: 'demo-button',
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export const ExperimentalFeatureStory = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  // 👇 Applies to all stories in this file
  tags: ['stable'],
};

export default meta;
type Story = StoryObj;

export const ExperimentalFeatureStory: Story = {
  //👇 For this particular story, remove the inherited `stable` tag and apply the `experimental` tag
  tags: ['!stable', 'experimental'],
};
```
