<!-- TODO: Vet this example for framework support and correct construct on tests -->

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/nextjs/navigation.mock';

import MyForm from './my-form';

export default {
  component: MyForm,
  parameters: {
    nextjs: {
      // 👇 As in the Next.js application, next/navigation only works using App Router
      appDirectory: true,
    },
  },
};

export const Unauthenticated = {
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
};

export const GoBack = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/nextjs/navigation.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
  parameters: {
    nextjs: {
      // 👇 As in the Next.js application, next/navigation only works using App Router
      appDirectory: true,
    },
  },
});

export const Unauthenticated = meta.story({
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
});

export const GoBack = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
});
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/nextjs/navigation.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
  parameters: {
    nextjs: {
      // 👇 As in the Next.js application, next/navigation only works using App Router
      appDirectory: true,
    },
  },
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unauthenticated: Story = {
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
};

export const GoBack: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/nextjs/navigation.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
  parameters: {
    nextjs: {
      // 👇 As in the Next.js application, next/navigation only works using App Router
      appDirectory: true,
    },
  },
});

export const Unauthenticated = meta.story({
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
});

export const GoBack = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
});
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/nextjs/navigation.mock';

import MyForm from './my-form';

const meta: Meta<typeof MyForm> = {
  component: MyForm,
  parameters: {
    nextjs: {
      // 👇 As in the Next.js application, next/navigation only works using App Router
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyForm>;

export const Unauthenticated: Story = {
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
};

export const GoBack: Story = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/nextjs/navigation.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
  parameters: {
    nextjs: {
      // 👇 As in the Next.js application, next/navigation only works using App Router
      appDirectory: true,
    },
  },
});

export const Unauthenticated = meta.story({
  play: async ({ canvasElement }) => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
});

export const GoBack = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
});
```
