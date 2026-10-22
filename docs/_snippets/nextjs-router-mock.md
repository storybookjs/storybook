<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { expect } from 'storybook/test';

// Replace your-framework with nextjs or nextjs-vite
import { getRouter } from '@storybook/your-framework/router';

import preview from '../.storybook/preview';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
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
import { getRouter } from '@storybook/your-framework/router.mock';

import preview from '../.storybook/preview';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
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
import { getRouter } from '@storybook/your-framework/router.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

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
import { getRouter } from '@storybook/your-framework/router';

import MyForm from './my-form';

export default {
  component: MyForm,
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
