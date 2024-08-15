```ts filename="Page.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';
import { Page } from './Page';

const meta: Meta<Page> = {
  component: Page,
};
export default meta;

type Story = StoryObj<Page>;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js"
import { getUserFromSession } from '#api/session.mock';
import { Page } from './Page';

export default {
  component: Page,
};

export const Default = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts-4-9"
// Replace your-renderer with the name of your renderer (e.g. react, vue3)
import type { Meta, StoryObj } from '@storybook/your-renderer';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';
import { Page } from './Page';

const meta = {
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts"
// Replace your-renderer with the name of your renderer (e.g. react, vue3)
import type { Meta, StoryObj } from '@storybook/your-renderer';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';
import { Page } from './Page';

const meta: Meta<typeof Page> = {
  component: Page,
};
export default meta;

type Story = StoryObj<typeof Page>;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```js filename="Page.stories.js" renderer="web-components" language="js"
import { getUserFromSession } from '#api/session.mock';

export default {
  component: 'my-page',
};

export const Default = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

const meta: Meta = {
  component: 'my-page',
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  async beforeEach() {
    // 👇 Set the return value for the getUserFromSession function
    getUserFromSession.mockReturnValue({ id: '1', name: 'Alice' });
  },
};
```

