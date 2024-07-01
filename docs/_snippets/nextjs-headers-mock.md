```js filename="MyForm.stories.js" renderer="react" language="js"
import { expect, userEvent, within } from '@storybook/test';
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
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, userEvent, within } from '@storybook/test';
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
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, userEvent, within } from '@storybook/test';
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
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('timezone');
  },
};
```

