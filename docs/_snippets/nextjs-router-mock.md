<!-- TODO: Vet this example for framework support and correct construct on tests -->

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs/router.mock';

import MyForm from './my-form';

export default {
  component: MyForm,
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
import { getRouter } from '@storybook/nextjs/router.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
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
import { getRouter } from '@storybook/nextjs/router.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

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
import { getRouter } from '@storybook/nextjs/router.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
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
import { getRouter } from '@storybook/nextjs/router.mock';

import MyForm from './my-form';

const meta: Meta<typeof MyForm> = {
  component: MyForm,
};

export default meta;
type Story = StoryObj<typeof MyForm>;

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

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs/router.mock';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
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
