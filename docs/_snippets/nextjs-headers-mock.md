<!-- TODO: Vet this example for framework support and correct construct on tests -->

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { expect } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers } from '@storybook/nextjs/headers.mock';

import MyForm from './my-form';

export default {
  component: MyForm,
};

export const LoggedInEurope = {
  async beforeEach() {
    // 👇 Set mock cookies and headers ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
};
```

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers } from '@storybook/nextjs/headers.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
});

export const LoggedInEurope = meta.story({
  async beforeEach() {
    // 👇 Set mock cookies and headers ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
});
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { expect } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers } from '@storybook/nextjs/headers.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedInEurope: Story = {
  async beforeEach() {
    // 👇 Set mock cookies and headers ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers } from '@storybook/nextjs/headers.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
});

export const LoggedInEurope = meta.story({
  async beforeEach() {
    // 👇 Set mock cookies and headers ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
});
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { expect } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers } from '@storybook/nextjs/headers.mock';

import MyForm from './my-form';

const meta: Meta<typeof MyForm> = {
  component: MyForm,
};

export default meta;
type Story = StoryObj<typeof MyForm>;

export const LoggedInEurope: Story = {
  async beforeEach() {
    // 👇 Set mock cookies and headers ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers } from '@storybook/nextjs/headers.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
});

export const LoggedInEurope = meta.story({
  async beforeEach() {
    // 👇 Set mock cookies and headers ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
});
```
