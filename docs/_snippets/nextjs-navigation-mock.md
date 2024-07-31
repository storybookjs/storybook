```js filename="MyForm.stories.js" renderer="react" language="js"
import { expect, fireEvent, userEvent, within } from '@storybook/test';
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
  async play() => {
    // 👇 Assert that your component called redirect()
    await expect(redirect).toHaveBeenCalledWith('/login', 'replace');
  },
};

export const GoBack = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, userEvent, within } from '@storybook/test';
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
  async play() => {
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

```ts filename="MyForm.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, userEvent, within } from '@storybook/test';
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
  async play() => {
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

