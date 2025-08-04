```ts filename="AuthButton.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { expect, mocked } from 'storybook/test';

import { AuthButton } from './AuthButton.component';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta: Meta<AuthButton> = {
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
};
export default meta;

type Story = StoryObj<AuthButton>;

export const LogIn: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```

```ts filename="AuthButton.stories.ts" renderer="common" language="ts"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect, mocked } from 'storybook/test';

import { AuthButton } from './AuthButton';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = {
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
} satisfies Meta<typeof AuthButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const LogIn: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```

```js filename="AuthButton.stories.js" renderer="common" language="js"
import { expect } from 'storybook/test';

import { AuthButton } from './AuthButton';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

export default {
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    uuidv4.mockReturnValue('1234-5678-90ab-cdef');
    getUserFromSession.mockReturnValue({ name: 'John Doe' });
  },
};

export const LogIn = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```

```svelte filename="AuthButton.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, mocked } from 'storybook/test';

  import { AuthButton } from './AuthButton.svelte';

  import { v4 as uuidv4 } from 'uuid';
  import { getUserFromSession } from '../lib/session';

  const { Story } = defineMeta({
    component: AuthButton,
    // 👇 This will run before each story is rendered
    beforeEach: async () => {
      // 👇 Force known, consistent behavior for mocked modules
      mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
      mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
    },
  });
</script>

<Story
  name="LogIn"
  play={async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  }}
/>
```

```ts filename="AuthButton.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect, mocked } from 'storybook/test';

import { AuthButton } from './AuthButton.svelte';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = {
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
} satisfies Meta<typeof AuthButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const LogIn: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```

```svelte filename="AuthButton.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect } from 'storybook/test';

  import { AuthButton } from './AuthButton.svelte';

  import { v4 as uuidv4 } from 'uuid';
  import { getUserFromSession } from '../lib/session';

  const { Story } = defineMeta({
    component: AuthButton,
    // 👇 This will run before each story is rendered
    beforeEach: async () => {
      // 👇 Force known, consistent behavior for mocked modules
      uuidv4.mockReturnValue('1234-5678-90ab-cdef');
      getUserFromSession.mockReturnValue({ name: 'John Doe' });
    },
  });
</script>

<Story
  name="LogIn"
  play={async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  }}
/>
```

```js filename="AuthButton.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { expect } from 'storybook/test';

import { AuthButton } from './AuthButton.svelte';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

export default {
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    uuidv4.mockReturnValue('1234-5678-90ab-cdef');
    getUserFromSession.mockReturnValue({ name: 'John Doe' });
  },
};

export const LogIn = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```

```ts filename="AuthButton.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, mocked } from 'storybook/test';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta: Meta = {
  component: 'demo-auth-button',
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
};
export default meta;

type Story = StoryObj;

export const LogIn: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```

```js filename="AuthButton.stories.js" renderer="web-components" language="js"
import { expect } from 'storybook/test';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

export default {
  component: 'demo-auth-button',
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    uuidv4.mockReturnValue('1234-5678-90ab-cdef');
    getUserFromSession.mockReturnValue({ name: 'John Doe' });
  },
};

export const LogIn = {
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
};
```
