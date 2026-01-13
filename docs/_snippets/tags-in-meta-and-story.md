```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button';

const meta: Meta<Button> = {
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<Button>;

export const ExperimentalFeatureStory: Story = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    /*
     * All stories in this file will have these tags applied:
     * - autodocs
     * - dev (implicit default, inherited from preview)
     * - test (implicit default, inherited from preview)
     */
    tags: ['autodocs'],
  });
</script>

<!--
  This particular story will have these tags applied:
  - experimental
  - autodocs (inherited from meta)
  - dev (inherited from meta)
  - test (inherited from meta)
-->
<Story name="ExperimentalFeatureStory" tags={['experimental']} />
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export const ExperimentalFeatureStory = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```js filename="Button.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export const ExperimentalFeatureStory = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    /*
     * All stories in this file will have these tags applied:
     * - autodocs
     * - dev (implicit default, inherited from preview)
     * - test (implicit default, inherited from preview)
     */
    tags: ['autodocs'],
  });
</script>

<!--
  This particular story will have these tags applied:
  - experimental
  - autodocs (inherited from meta)
  - dev (inherited from meta)
  - test (inherited from meta)
-->
<Story name="ExperimentalFeatureStory" tags={['experimental']} />
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExperimentalFeatureStory: Story = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExperimentalFeatureStory: Story = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  title: 'Button',
  component: 'demo-button',
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export const ExperimentalFeatureStory = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  /*
   * All stories in this file will have these tags applied:
   *  - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ExperimentalFeatureStory: Story = {
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,

  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,

  /*
   * All stories in this file will have these tags applied:
   * - autodocs
   * - dev (implicit default, inherited from preview)
   * - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
});

export const ExperimentalFeatureStory = meta.story({
  /*
   * This particular story will have these tags applied:
   * - experimental
   * - autodocs (inherited from meta)
   * - dev (inherited from meta)
   * - test (inherited from meta)
   */
  tags: ['experimental'],
});
```
