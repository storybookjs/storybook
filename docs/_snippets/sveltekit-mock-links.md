```svelte filename="Nav.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import { link } from '@storybook/sveltekit/navigation.mock';
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import preview from '../.storybook/preview';

  import Nav from './Nav.svelte';

  const { Story } = preview.meta({
    component: Nav,
  });
</script>

<Story
  name="Opens settings"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: 'Settings' }));
    // 👇 Assert that the user clicked a link to /settings
    await expect(link).toHaveBeenCalledWith('/settings', expect.anything());
  }}
/>

<Story
  name="Follows links"
  beforeEach={() => {
    // 👇 Update page.url on every link click, as if the app had navigated
    link.mockImplementation((href) => {
      page.url = new URL(href, page.url.href);
    });
  }}
/>
```

```svelte filename="Nav.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  import { link } from '@storybook/sveltekit/navigation.mock';
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import Nav from './Nav.svelte';

  const { Story } = defineMeta({
    component: Nav,
  });
</script>

<Story
  name="Opens settings"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: 'Settings' }));
    // 👇 Assert that the user clicked a link to /settings
    await expect(link).toHaveBeenCalledWith('/settings', expect.anything());
  }}
/>

<Story
  name="Follows links"
  beforeEach={() => {
    // 👇 Update page.url on every link click, as if the app had navigated
    link.mockImplementation((href) => {
      page.url = new URL(href, page.url.href);
    });
  }}
/>
```

```svelte filename="Nav.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import { link } from '@storybook/sveltekit/navigation.mock';
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import preview from '../.storybook/preview';

  import Nav from './Nav.svelte';

  const { Story } = preview.meta({
    component: Nav,
  });
</script>

<Story
  name="Opens settings"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: 'Settings' }));
    // 👇 Assert that the user clicked a link to /settings
    await expect(link).toHaveBeenCalledWith('/settings', expect.anything());
  }}
/>

<Story
  name="Follows links"
  beforeEach={() => {
    // 👇 Update page.url on every link click, as if the app had navigated
    link.mockImplementation((href) => {
      page.url = new URL(href, page.url.href);
    });
  }}
/>
```

```svelte filename="Nav.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  import { link } from '@storybook/sveltekit/navigation.mock';
  // 👇 $app/state is a native SvelteKit module. Storybook mocks it, so stories can set it.
  import { page } from '$app/state';
  import { expect } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import Nav from './Nav.svelte';

  const { Story } = defineMeta({
    component: Nav,
  });
</script>

<Story
  name="Opens settings"
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: 'Settings' }));
    // 👇 Assert that the user clicked a link to /settings
    await expect(link).toHaveBeenCalledWith('/settings', expect.anything());
  }}
/>

<Story
  name="Follows links"
  beforeEach={() => {
    // 👇 Update page.url on every link click, as if the app had navigated
    link.mockImplementation((href) => {
      page.url = new URL(href, page.url.href);
    });
  }}
/>
```
