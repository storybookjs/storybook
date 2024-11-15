```ts filename="RegistrationForm.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { userEvent, within } from '@storybook/test';

import { RegistrationForm } from './RegistrationForm.component';

const meta: Meta<RegistrationForm> = {
  component: RegistrationForm,
};

export default meta;
type Story = StoryObj<RegistrationForm>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```svelte filename="RegistrationForm.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { userEvent, within } from '@storybook/test';

  import RegistrationForm from './RegistrationForm.svelte';

  const { Story } = defineMeta({
    component: RegistrationForm,
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvasElement to query the DOM
-->
<Story
  name="FilledForm"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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

    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  }}
/>
```

```js filename="RegistrationForm.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { userEvent, within } from '@storybook/test';

import RegistrationForm from './RegistrationForm.svelte';

export default {
  component: RegistrationForm,
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```js filename="RegistrationForm.stories.js|jsx" renderer="common" language="js"
import { userEvent, within } from '@storybook/test';

import { RegistrationForm } from './RegistrationForm';

export default {
  component: RegistrationForm,
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```svelte filename="RegistrationForm.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { userEvent, within } from '@storybook/test';

  import RegistrationForm from './RegistrationForm.svelte';

  const { Story } = defineMeta({
    component: RegistrationForm,
  });
</script>


<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvasElement to query the DOM
-->
<Story
  name="FilledForm"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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

    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  }}
/>
```

```ts filename="RegistrationForm.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import { userEvent, within } from '@storybook/test';

import RegistrationForm from './RegistrationForm.svelte';

const meta = {
  component: RegistrationForm,
} satisfies Meta<typeof RegistrationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```ts filename="RegistrationForm.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { RegistrationForm } from './RegistrationForm';

const meta = {
  component: RegistrationForm,
} satisfies Meta<typeof RegistrationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```svelte filename="RegistrationForm.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { userEvent, within } from '@storybook/test';

  import RegistrationForm from './RegistrationForm.svelte';

  const { Story } = defineMeta({
    component: RegistrationForm,
  });
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvasElement to query the DOM
-->
<Story
  name="FilledForm"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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

    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  }}
/>
```

```ts filename="RegistrationForm.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import { userEvent, within } from '@storybook/test';

import RegistrationForm from './RegistrationForm.svelte';

const meta: Meta<typeof RegistrationForm> = {
  component: RegistrationForm,
};

export default meta;
type Story = StoryObj<typeof RegistrationForm>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```ts filename="RegistrationForm.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { RegistrationForm } from './RegistrationForm';

const meta: Meta<typeof RegistrationForm> = {
  component: RegistrationForm,
};

export default meta;
type Story = StoryObj<typeof RegistrationForm>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```js filename="RegistrationForm.stories.js" renderer="web-components" language="js"
import { userEvent, within } from '@storybook/test';

export default {
  component: 'demo-registration-form',
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```

```ts filename="RegistrationForm.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { userEvent, within } from '@storybook/test';

const meta: Meta = {
  component: 'demo-registration-form',
};

export default meta;
type Story = StoryObj;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

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
    // See https://storybook.js.org/docs/essentials/actions#automatically-matching-args to learn how to setup logging in the Actions panel
    const submitButton = canvas.getByRole('button');

    await userEvent.click(submitButton);
  },
};
```
