```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import MockDate from 'mockdate';

import preview from '../.storybook/preview';

import Page from './Page';

const meta = preview.meta({
  component: Page,
});

export const ChristmasUI = meta.story({
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
});
```

```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import MockDate from 'mockdate';

import preview from '../.storybook/preview';

import Page from './page.component';

const meta = preview.meta({
  component: Page,
});

export const ChristmasUI = meta.story({
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
});
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import MockDate from 'mockdate';

import preview from '../.storybook/preview';

import Page from './Page';

const meta = preview.meta({
  component: Page,
});

export const ChristmasUI = meta.story({
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
  });
</script>

<Story
  name="ChristmasUI"
  play={async ({ mount }) => {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  }}
/>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
  });
</script>

<Story
  name="ChristmasUI"
  play={async ({ mount }) => {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  }}
/>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
  });
</script>

<Story
  name="ChristmasUI"
  play={async ({ mount }) => {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  }}
/>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
  });
</script>

<Story
  name="ChristmasUI"
  play={async ({ mount }) => {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  }}
/>
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import MockDate from 'mockdate';

import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
});

export const ChristmasUI = meta.story({
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
});
```

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import MockDate from 'mockdate';

import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
});

export const ChristmasUI = meta.story({
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
});
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import MockDate from 'mockdate';

// ...rest of story file

export const ChristmasUI: Story = {
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import MockDate from 'mockdate';

// ...rest of story file

export const ChristmasUI = {
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
};
```
