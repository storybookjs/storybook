```ts filename="AuthButton.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { expect, mocked } from 'storybook/test';

import preview from '../.storybook/preview';

import { AuthButton } from './auth-button.component';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```ts filename="AuthButton.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { expect, mocked } from 'storybook/test';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-auth-button',
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```ts filename="AuthButton.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import { expect, mocked } from 'storybook/test';

import preview from '../.storybook/preview';

import { AuthButton } from './AuthButton';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```js filename="AuthButton.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-auth-button',
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    uuidv4.mockReturnValue('1234-5678-90ab-cdef');
    getUserFromSession.mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```svelte filename="AuthButton.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';
  import { expect, mocked } from 'storybook/test';

  import AuthButton from './AuthButton.svelte';

  import { v4 as uuidv4 } from 'uuid';
  import { getUserFromSession } from '../lib/session';

  const { Story } = preview.meta({
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

```svelte filename="AuthButton.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
  import { expect, mocked } from 'storybook/test';

  import AuthButton from './AuthButton.svelte';

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

```svelte filename="AuthButton.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';
  import { expect } from 'storybook/test';

  import { AuthButton } from './AuthButton.svelte';

  import { v4 as uuidv4 } from 'uuid';
  import { getUserFromSession } from '../lib/session';

  const { Story } = preview.meta({
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

```svelte filename="AuthButton.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';
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

```ts filename="AuthButton.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { expect, mocked } from 'storybook/test';

import preview from '../.storybook/preview';

import AuthButton from './AuthButton.vue';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    mocked(uuidv4).mockReturnValue('1234-5678-90ab-cdef');
    mocked(getUserFromSession).mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```js filename="AuthButton.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

import { AuthButton } from './AuthButton';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    uuidv4.mockReturnValue('1234-5678-90ab-cdef');
    getUserFromSession.mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```ts filename="AuthButton.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';
import { expect, mocked } from 'storybook/test';

import { AuthButton } from './auth-button.component';

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

```js filename="AuthButton.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { expect } from 'storybook/test';

import preview from '../.storybook/preview';

import AuthButton from './AuthButton.vue';

import { v4 as uuidv4 } from 'uuid';
import { getUserFromSession } from '../lib/session';

const meta = preview.meta({
  component: AuthButton,
  // 👇 This will run before each story is rendered
  beforeEach: async () => {
    // 👇 Force known, consistent behavior for mocked modules
    uuidv4.mockReturnValue('1234-5678-90ab-cdef');
    getUserFromSession.mockReturnValue({ name: 'John Doe' });
  },
});

export const LogIn = meta.story({
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Sign in' });
    userEvent.click(button);

    // Assert that the getUserFromSession function was called
    expect(getUserFromSession).toHaveBeenCalled();
  },
});
```

```ts filename="AuthButton.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```js filename="AuthButton.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```ts filename="AuthButton.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```js filename="AuthButton.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
