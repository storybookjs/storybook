```js filename="Navbar.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { Navbar } from './Navbar';

export default {
  component: Navbar,
};

export const Default = {};

export const LoggedIn = {
  loaders: [
    async ({ parameters }) => {
      const qc = parameters.tanstack?.router?.context?.queryClient;
      qc?.setQueryData(['currentUser'], {
        id: 'user-1',
        name: 'Ada Lovelace',
      });
    },
  ],
};
```

```ts filename="Navbar.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/tanstack-react';
import type { QueryClient } from '@tanstack/react-query';

import { Navbar } from './Navbar';

const meta = {
  component: Navbar,
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LoggedIn: Story = {
  loaders: [
    async ({ parameters }) => {
      const qc: QueryClient = parameters.tanstack?.router?.context?.queryClient;
      qc?.setQueryData(['currentUser'], {
        id: 'user-1',
        name: 'Ada Lovelace',
      });
    },
  ],
};
```

```ts filename="Navbar.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import type { QueryClient } from '@tanstack/react-query';

import preview from '../.storybook/preview';

import { Navbar } from './Navbar';

const meta = preview.meta({
  component: Navbar,
});

export const Default = meta.story();

export const LoggedIn = meta.story({
  loaders: [
    async ({ parameters }) => {
      const qc: QueryClient = parameters.tanstack?.router?.context?.queryClient;
      qc?.setQueryData(['currentUser'], {
        id: 'user-1',
        name: 'Ada Lovelace',
      });
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Navbar.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Navbar } from './Navbar';

const meta = preview.meta({
  component: Navbar,
});

export const Default = meta.story();

export const LoggedIn = meta.story({
  loaders: [
    async ({ parameters }) => {
      const qc = parameters.tanstack?.router?.context?.queryClient;
      qc?.setQueryData(['currentUser'], {
        id: 'user-1',
        name: 'Ada Lovelace',
      });
    },
  ],
});
```
