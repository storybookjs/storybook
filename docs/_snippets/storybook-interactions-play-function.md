```ts filename="Form.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

import { Form } from './form.component';

const meta = preview.meta({
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the submit output
    submit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```ts filename="Form.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-form-element',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```svelte filename="Form.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import { expect, fn, waitFor } from 'storybook/test';

  import Form from './Form.svelte';

  const { Story } = preview.meta({
    component: Form,
    args: {
      // 👇 Use `fn` to spy on the submit output
      onSubmit: fn(),
    },
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvas to query the DOM
 -->
<Story
  name="Submitted"
  play={async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  }}
/>
```

```svelte filename="Form.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { expect, fn, waitFor } from 'storybook/test';

  import Form from './Form.svelte';

  const { Story } = defineMeta({
    component: Form,
    args: {
      // 👇 Use `fn` to spy on the submit output
      onSubmit: fn(),
    },
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvas to query the DOM
 -->
<Story
  name="Submitted"
  play={async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  }}
/>
```

```js filename="Form.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-form-element',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```svelte filename="Form.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import { expect, fn, waitFor } from 'storybook/test';

  import Form from './Form.svelte';

  const { Story } = preview.meta({
    component: Form,
    args: {
      // 👇 Use `fn` to spy on the submit output
      onSubmit: fn(),
    },
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvas to query the DOM
 -->
<Story
  name="Submitted"
  play={async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  }}
/>
```

```svelte filename="Form.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { expect, fn, waitFor } from 'storybook/test';

  import Form from './Form.svelte';

  const { Story } = defineMeta({
    component: Form,
    args: {
      // 👇 Use `fn` to spy on the submit output
      onSubmit: fn(),
    },
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvas to query the DOM
 -->
<Story
  name="Submitted"
  play={async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  }}
/>
```

```ts filename="Form.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

import { Form } from './Form';

const meta = preview.meta({
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```js filename="Form.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

import { Form } from './Form';

const meta = preview.meta({
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    // Starts querying the component from its root element
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```ts filename="Form.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

import Form from './Form.vue';

const meta = preview.meta({
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```js filename="Form.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../.storybook/preview';

import Form from './Form.vue';

const meta = preview.meta({
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = meta.story({
  play: async ({ args, canvas, step, userEvent }) => {
    // Starts querying the component from its root element
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
});
```

```ts filename="Form.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';
import { expect, fn, waitFor } from 'storybook/test';

import { Form } from './form.component';

const meta: Meta<Form> = {
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the submit output
    submit: fn(),
  },
};
export default meta;

type Story = StoryObj<Form>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```ts filename="Form.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { expect, fn, waitFor } from 'storybook/test';

import { Form } from './Form';

const meta = {
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
} satisfies Meta<typeof Form>;
export default meta;

type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```js filename="Form.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { expect, fn, waitFor } from 'storybook/test';

import { Form } from './Form';

export default {
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = {
  play: async ({ args, canvas, step, userEvent }) => {
    // Starts querying the component from its root element
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```ts filename="Form.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { expect, fn, waitFor } from 'storybook/test';

const meta: Meta = {
  component: 'my-form-element',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};
export default meta;

type Story = StoryObj;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```js filename="Form.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { expect, fn, waitFor } from 'storybook/test';

export default {
  component: 'my-form-element',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const Submitted = {
  play: async ({ args, canvas, step, userEvent }) => {
    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```
