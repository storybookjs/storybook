<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { expect } from 'storybook/test';

// Replace your-framework with nextjs or nextjs-vite
import { redirect, getRouter } from '@storybook/your-framework/navigation.mock';

import preview from '../.storybook/preview';

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
  async play() {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
});

export const GoBack = meta.story({
  async play({ canvas, userEvent }) {
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
});
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { expect } from 'storybook/test';

/*
 * Replace your-framework with nextjs or nextjs-vite
 * 👇 Must include the `.mock` portion of filename to have mocks typed correctly
 */
import { redirect, getRouter } from '@storybook/your-framework/navigation.mock';

import preview from '../.storybook/preview';

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
  async play() {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
});

export const GoBack = meta.story({
  async play({ canvas, userEvent }) {
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
});
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import { expect } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { redirect, getRouter } from '@storybook/your-framework/navigation.mock';

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
  async play() {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
};

export const GoBack: Story = {
  async play({ canvas, userEvent }) {
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { expect } from 'storybook/test';

// Replace your-framework with nextjs or nextjs-vite
import { redirect, getRouter } from '@storybook/your-framework/navigation';

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
  async play() {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
};

export const GoBack = {
  async play({ canvas, userEvent }) {
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```
