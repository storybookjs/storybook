```svelte filename="Header.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';

  import preview from '../.storybook/preview';

  import Header from './Header.svelte';

  const { Story } = preview.meta({
    component: Header,
    tags: ['autodocs'],
    parameters: {
      // 👇 On the docs page, render each story in an iframe, with its own SvelteKit mocks
      docs: { story: { inline: false } },
    },
  });
</script>

<Story
  name="Logged out"
  beforeEach={() => {
    page.data = { user: null };
  }}
/>

<Story
  name="Logged in"
  beforeEach={() => {
    page.data = { user: { name: 'Ada' } };
  }}
/>
```

```svelte filename="Header.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';

  import { defineMeta } from '@storybook/sveltekit';

  import Header from './Header.svelte';

  const { Story } = defineMeta({
    component: Header,
    tags: ['autodocs'],
    parameters: {
      // 👇 On the docs page, render each story in an iframe, with its own SvelteKit mocks
      docs: { story: { inline: false } },
    },
  });
</script>

<Story
  name="Logged out"
  beforeEach={() => {
    page.data = { user: null };
  }}
/>

<Story
  name="Logged in"
  beforeEach={() => {
    page.data = { user: { name: 'Ada' } };
  }}
/>
```

```svelte filename="Header.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';

  import preview from '../.storybook/preview';

  import Header from './Header.svelte';

  const { Story } = preview.meta({
    component: Header,
    tags: ['autodocs'],
    parameters: {
      // 👇 On the docs page, render each story in an iframe, with its own SvelteKit mocks
      docs: { story: { inline: false } },
    },
  });
</script>

<Story
  name="Logged out"
  beforeEach={() => {
    page.data = { user: null };
  }}
/>

<Story
  name="Logged in"
  beforeEach={() => {
    page.data = { user: { name: 'Ada' } };
  }}
/>
```

```svelte filename="Header.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';

  import { defineMeta } from '@storybook/sveltekit';

  import Header from './Header.svelte';

  const { Story } = defineMeta({
    component: Header,
    tags: ['autodocs'],
    parameters: {
      // 👇 On the docs page, render each story in an iframe, with its own SvelteKit mocks
      docs: { story: { inline: false } },
    },
  });
</script>

<Story
  name="Logged out"
  beforeEach={() => {
    page.data = { user: null };
  }}
/>

<Story
  name="Logged in"
  beforeEach={() => {
    page.data = { user: { name: 'Ada' } };
  }}
/>
```
