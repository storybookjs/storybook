```ts filename="RegistrationForm.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { RegistrationForm } from './RegistrationForm.component';

const meta: Meta<RegistrationForm> = {
  component: RegistrationForm,
};

export default meta;
type Story = StoryObj<RegistrationForm>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```svelte filename="RegistrationForm.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import RegistrationForm from './RegistrationForm.svelte';

  const { Story } = defineMeta({
    component: RegistrationForm,
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvas to query the DOM
-->
<Story
  name="FilledForm"
  play={async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  }}
/>
```

```js filename="RegistrationForm.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import RegistrationForm from './RegistrationForm.svelte';

export default {
  component: RegistrationForm,
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```js filename="RegistrationForm.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { RegistrationForm } from './RegistrationForm';

export default {
  component: RegistrationForm,
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```svelte filename="RegistrationForm.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import RegistrationForm from './RegistrationForm.svelte';

  const { Story } = defineMeta({
    component: RegistrationForm,
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvas to query the DOM
-->
<Story
  name="FilledForm"
  play={async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  }}
/>
```

```ts filename="RegistrationForm.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import RegistrationForm from './RegistrationForm.svelte';

const meta = {
  component: RegistrationForm,
} satisfies Meta<typeof RegistrationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```ts filename="RegistrationForm.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { RegistrationForm } from './RegistrationForm';

const meta = {
  component: RegistrationForm,
} satisfies Meta<typeof RegistrationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```js filename="RegistrationForm.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-registration-form',
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```ts filename="RegistrationForm.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-registration-form',
};

export default meta;
type Story = StoryObj;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
};
```

```ts filename="RegistrationForm.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { RegistrationForm } from './RegistrationForm';

const meta = preview.meta({
  component: RegistrationForm,
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm = meta.story({
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="RegistrationForm.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { RegistrationForm } from './RegistrationForm';

const meta = preview.meta({
  component: RegistrationForm,
});

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FilledForm = meta.story({
  play: async ({ canvas, userEvent }) => {
    const emailInput = canvas.getByLabelText('email', {
      selector: 'input',
    });

    await userEvent.type(emailInput, 'example-email@email.com', {
      delay: 100,
    });

    const passwordInput = canvas.getByLabelText('password', {
      selector: 'input',
    });

    await userEvent.type(passwordInput, 'ExamplePassword', {
      delay: 100,
    });

    const submitButton = canvas.getByRole('button');
    await userEvent.click(submitButton);
  },
});
```
