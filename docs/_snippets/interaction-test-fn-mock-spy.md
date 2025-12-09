```ts filename="LoginForm.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm.component';

const meta: Meta<LoginForm> = {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};
export default meta;

type Story = StoryObj<LoginForm>;

export const FilledForm: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```ts filename="LoginForm.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm';

const meta = {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const FilledForm: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```js filename="LoginForm.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm';

export default {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export const FilledForm = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```svelte filename="LoginForm.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import LoginForm from './LoginForm.svelte';

  const { Story } = defineMeta({
    component: LoginForm,
    args: {
      // 👇 Use `fn` to spy on the onSubmit arg
      onSubmit: fn(),
    },
  });
</script>

<Story
  name="FilledForm"
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  }}
/>
```

```ts filename="LoginForm.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm.svelte';

const meta = {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const FilledForm: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```svelte filename="LoginForm.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import LoginForm from './LoginForm.svelte';

  const { Story } = defineMeta({
    component: LoginForm,
    args: {
      // 👇 Use `fn` to spy on the onSubmit arg
      onSubmit: fn(),
    },
  });
</script>

<Story
  name="FilledForm"
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  }}
/>
```

```js filename="LoginForm.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm.svelte';

export default {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export const FilledForm = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```ts filename="LoginForm.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { fn, expect } from 'storybook/test';

const meta: Meta = {
  component: 'demo-login-form',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};
export default meta;

type Story = StoryObj;

export const FilledForm: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```js filename="LoginForm.stories.js" renderer="web-components" language="js"
import { fn, expect } from 'storybook/test';

export default {
  component: 'demo-login-form',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export const FilledForm = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```ts filename="LoginForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm';

const meta = preview.meta({
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

export const FilledForm = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="LoginForm.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { fn, expect } from 'storybook/test';

import { LoginForm } from './LoginForm';

const meta = preview.meta({
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
});

export const FilledForm = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
});
```
