```js filename="Page.stories.js" renderer="common" language="js"
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

```ts filename="Page.stories.ts" renderer="common" language="ts"
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

```svelte filename="LoginForm.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Calendar from './Calendar.svelte';

  const { Story } = defineMeta({
    component: Calendar,
  });
</script>

<Story
  name="ChristmasUI"
  play={async ({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  }}
/>
```

```ts filename="LoginForm.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
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

```svelte filename="LoginForm.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Calendar from './Calendar.svelte';

  const { Story } = defineMeta({
    component: Calendar,
  });
</script>

<Story
  name="ChristmasUI"
  play={async ({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  }}
/>
```

```js filename="LoginForm.stories.js" renderer="svelte" language="js" tabTitle="CSF"
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
