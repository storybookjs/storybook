```svelte filename="Header.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import preview from '../.storybook/preview';

  import Header from './Header.svelte';

  const { Story } = preview.meta({
    component: Header,
    // 👇 Runs before every story in this file
    beforeEach() {
      page.url = new URL('http://localhost/dashboard');
      page.data = { user: null };
    },
  });
</script>

<Story name="Logged out" />

<Story
  name="Logged in"
  beforeEach={() => {
    // 👇 Runs after the meta's beforeEach, so it overrides page.data
    page.data = { user: { name: 'Ada' } };
  }}
/>

<Story
  name="Logs in"
  play={async ({ canvas }) => {
    // 👇 page is reactive: the component re-renders
    page.data = { user: { name: 'Ada' } };
    await expect(await canvas.findByText('Welcome, Ada')).toBeVisible();
  }}
/>
```

```svelte filename="Header.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import Header from './Header.svelte';

  const { Story } = defineMeta({
    component: Header,
    // 👇 Runs before every story in this file
    beforeEach() {
      page.url = new URL('http://localhost/dashboard');
      page.data = { user: null };
    },
  });
</script>

<Story name="Logged out" />

<Story
  name="Logged in"
  beforeEach={() => {
    // 👇 Runs after the meta's beforeEach, so it overrides page.data
    page.data = { user: { name: 'Ada' } };
  }}
/>

<Story
  name="Logs in"
  play={async ({ canvas }) => {
    // 👇 page is reactive: the component re-renders
    page.data = { user: { name: 'Ada' } };
    await expect(await canvas.findByText('Welcome, Ada')).toBeVisible();
  }}
/>
```

```svelte filename="Header.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import preview from '../.storybook/preview';

  import Header from './Header.svelte';

  const { Story } = preview.meta({
    component: Header,
    // 👇 Runs before every story in this file
    beforeEach() {
      page.url = new URL('http://localhost/dashboard');
      page.data = { user: null };
    },
  });
</script>

<Story name="Logged out" />

<Story
  name="Logged in"
  beforeEach={() => {
    // 👇 Runs after the meta's beforeEach, so it overrides page.data
    page.data = { user: { name: 'Ada' } };
  }}
/>

<Story
  name="Logs in"
  play={async ({ canvas }) => {
    // 👇 page is reactive: the component re-renders
    page.data = { user: { name: 'Ada' } };
    await expect(await canvas.findByText('Welcome, Ada')).toBeVisible();
  }}
/>
```

```svelte filename="Header.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import Header from './Header.svelte';

  const { Story } = defineMeta({
    component: Header,
    // 👇 Runs before every story in this file
    beforeEach() {
      page.url = new URL('http://localhost/dashboard');
      page.data = { user: null };
    },
  });
</script>

<Story name="Logged out" />

<Story
  name="Logged in"
  beforeEach={() => {
    // 👇 Runs after the meta's beforeEach, so it overrides page.data
    page.data = { user: { name: 'Ada' } };
  }}
/>

<Story
  name="Logs in"
  play={async ({ canvas }) => {
    // 👇 page is reactive: the component re-renders
    page.data = { user: { name: 'Ada' } };
    await expect(await canvas.findByText('Welcome, Ada')).toBeVisible();
  }}
/>
```
