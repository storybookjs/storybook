<!-- Vet this example for async pattern and CSF Next compatibility -->

```ts filename="Page.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

const meta: Meta<Page> = {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export default meta;
type Story = StoryObj<Page>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
};
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

export default {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export const Default = {
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
};
```

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
});
```

```ts filename="Page.stories.ts" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-renderer with the name of your renderer (e.g. react, vue3)
import type { Meta, StoryObj } from '@storybook/your-renderer';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

const meta = {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
});
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the name of your renderer (e.g. react, vue3)
import type { Meta, StoryObj } from '@storybook/your-renderer';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

const meta: Meta<typeof Page> = {
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export default meta;
type Story = StoryObj<typeof Page>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
});

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
});
```

```js filename="Page.stories.js" renderer="web-components" language="js"
import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '../../api/session.mock';

export default {
  component: 'my-page',
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export const Default = {
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import MockDate from 'mockdate';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getUserFromSession } from '#api/session.mock';

const meta: Meta = {
  component: 'my-page',
  // 👇 Set the value of Date for every story in the file
  async beforeEach() {
    MockDate.set('2024-02-14');

    // 👇 Reset the Date after each story
    return () => {
      MockDate.reset();
    };
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // ... This will run with the mocked Date
  },
};
```
