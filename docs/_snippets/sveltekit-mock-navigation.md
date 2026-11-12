```svelte filename="LogoutButton.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { expect, mocked } from 'storybook/test';

  import preview from '../.storybook/preview';

  import LogoutButton from './LogoutButton.svelte';

  const { Story } = preview.meta({
    component: LogoutButton,
  });
</script>

<Story
  name="Logs out"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Log out' }));
    // 👇 Assert that the component called goto()
    await expect(goto).toHaveBeenCalledWith('/login');
  }}
/>

<Story
  name="Updates the URL"
  beforeEach={() => {
    // 👇 Give goto() an implementation for this story only
    mocked(goto).mockImplementation(async (url) => {
      page.url = new URL(url, page.url.href);
    });
  }}
/>
```

```svelte filename="LogoutButton.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { expect, mocked } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import LogoutButton from './LogoutButton.svelte';

  const { Story } = defineMeta({
    component: LogoutButton,
  });
</script>

<Story
  name="Logs out"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Log out' }));
    // 👇 Assert that the component called goto()
    await expect(goto).toHaveBeenCalledWith('/login');
  }}
/>

<Story
  name="Updates the URL"
  beforeEach={() => {
    // 👇 Give goto() an implementation for this story only
    mocked(goto).mockImplementation(async (url) => {
      page.url = new URL(url, page.url.href);
    });
  }}
/>
```

```svelte filename="LogoutButton.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { expect, mocked } from 'storybook/test';

  import preview from '../.storybook/preview';

  import LogoutButton from './LogoutButton.svelte';

  const { Story } = preview.meta({
    component: LogoutButton,
  });
</script>

<Story
  name="Logs out"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Log out' }));
    // 👇 Assert that the component called goto()
    await expect(goto).toHaveBeenCalledWith('/login');
  }}
/>

<Story
  name="Updates the URL"
  beforeEach={() => {
    // 👇 Give goto() an implementation for this story only
    mocked(goto).mockImplementation(async (url) => {
      page.url = new URL(url, page.url.href);
    });
  }}
/>
```

```svelte filename="LogoutButton.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { expect, mocked } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import LogoutButton from './LogoutButton.svelte';

  const { Story } = defineMeta({
    component: LogoutButton,
  });
</script>

<Story
  name="Logs out"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Log out' }));
    // 👇 Assert that the component called goto()
    await expect(goto).toHaveBeenCalledWith('/login');
  }}
/>

<Story
  name="Updates the URL"
  beforeEach={() => {
    // 👇 Give goto() an implementation for this story only
    mocked(goto).mockImplementation(async (url) => {
      page.url = new URL(url, page.url.href);
    });
  }}
/>
```
