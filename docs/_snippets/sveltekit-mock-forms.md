```svelte filename="SubscribeForm.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import { formAction } from '@storybook/sveltekit/forms.mock';
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { expect } from 'storybook/test';

  import preview from '../.storybook/preview';

  import SubscribeForm from './SubscribeForm.svelte';

  const { Story } = preview.meta({
    component: SubscribeForm,
  });
</script>

<Story
  name="Subscribes"
  play={async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 The submission that SvelteKit would have sent to the server
    await expect(formAction).toHaveBeenCalledWith(
      expect.objectContaining({ formData: expect.any(FormData) })
    );
  }}
/>

<Story
  name="Invalid email"
  beforeEach={() => {
    // 👇 The result of the form action. use:enhance sets page.form and page.status from it.
    formAction.mockResolvedValue({
      type: 'failure',
      status: 400,
      data: { error: 'Invalid email' },
    });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    await expect(await canvas.findByText('Invalid email')).toBeVisible();
  }}
/>

<Story
  name="Redirects"
  beforeEach={() => {
    formAction.mockResolvedValue({ type: 'redirect', status: 303, location: '/thanks' });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 A redirect result calls goto()
    await expect(goto).toHaveBeenCalledWith('/thanks');
  }}
/>
```

```svelte filename="SubscribeForm.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  import { formAction } from '@storybook/sveltekit/forms.mock';
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { expect } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import SubscribeForm from './SubscribeForm.svelte';

  const { Story } = defineMeta({
    component: SubscribeForm,
  });
</script>

<Story
  name="Subscribes"
  play={async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 The submission that SvelteKit would have sent to the server
    await expect(formAction).toHaveBeenCalledWith(
      expect.objectContaining({ formData: expect.any(FormData) })
    );
  }}
/>

<Story
  name="Invalid email"
  beforeEach={() => {
    // 👇 The result of the form action. use:enhance sets page.form and page.status from it.
    formAction.mockResolvedValue({
      type: 'failure',
      status: 400,
      data: { error: 'Invalid email' },
    });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    await expect(await canvas.findByText('Invalid email')).toBeVisible();
  }}
/>

<Story
  name="Redirects"
  beforeEach={() => {
    formAction.mockResolvedValue({ type: 'redirect', status: 303, location: '/thanks' });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 A redirect result calls goto()
    await expect(goto).toHaveBeenCalledWith('/thanks');
  }}
/>
```

```svelte filename="SubscribeForm.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import { formAction } from '@storybook/sveltekit/forms.mock';
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { expect } from 'storybook/test';

  import preview from '../.storybook/preview';

  import SubscribeForm from './SubscribeForm.svelte';

  const { Story } = preview.meta({
    component: SubscribeForm,
  });
</script>

<Story
  name="Subscribes"
  play={async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 The submission that SvelteKit would have sent to the server
    await expect(formAction).toHaveBeenCalledWith(
      expect.objectContaining({ formData: expect.any(FormData) })
    );
  }}
/>

<Story
  name="Invalid email"
  beforeEach={() => {
    // 👇 The result of the form action. use:enhance sets page.form and page.status from it.
    formAction.mockResolvedValue({
      type: 'failure',
      status: 400,
      data: { error: 'Invalid email' },
    });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    await expect(await canvas.findByText('Invalid email')).toBeVisible();
  }}
/>

<Story
  name="Redirects"
  beforeEach={() => {
    formAction.mockResolvedValue({ type: 'redirect', status: 303, location: '/thanks' });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 A redirect result calls goto()
    await expect(goto).toHaveBeenCalledWith('/thanks');
  }}
/>
```

```svelte filename="SubscribeForm.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  import { formAction } from '@storybook/sveltekit/forms.mock';
  // 👇 $app/navigation is a native SvelteKit module. Storybook mocks it, so stories can spy on it.
  import { goto } from '$app/navigation';
  import { expect } from 'storybook/test';

  import { defineMeta } from '@storybook/sveltekit';

  import SubscribeForm from './SubscribeForm.svelte';

  const { Story } = defineMeta({
    component: SubscribeForm,
  });
</script>

<Story
  name="Subscribes"
  play={async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 The submission that SvelteKit would have sent to the server
    await expect(formAction).toHaveBeenCalledWith(
      expect.objectContaining({ formData: expect.any(FormData) })
    );
  }}
/>

<Story
  name="Invalid email"
  beforeEach={() => {
    // 👇 The result of the form action. use:enhance sets page.form and page.status from it.
    formAction.mockResolvedValue({
      type: 'failure',
      status: 400,
      data: { error: 'Invalid email' },
    });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    await expect(await canvas.findByText('Invalid email')).toBeVisible();
  }}
/>

<Story
  name="Redirects"
  beforeEach={() => {
    formAction.mockResolvedValue({ type: 'redirect', status: 303, location: '/thanks' });
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
    // 👇 A redirect result calls goto()
    await expect(goto).toHaveBeenCalledWith('/thanks');
  }}
/>
```
