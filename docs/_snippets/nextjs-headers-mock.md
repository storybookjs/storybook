```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { expect, fn } from 'storybook/test';

// Replace your-framework with nextjs or nextjs-vite
import { cookies, headers, draftMode } from '@storybook/your-framework/headers';

import MyForm from './my-form';

export default {
  component: MyForm,
};

export const LoggedInEurope = {
  async beforeEach() {
    // 👇 Set mock cookies, headers and draft mode ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
    draftMode.mockReturnValue({
      isEnabled: true,
      enable: fn(),
      disable: fn(),
    });
  },
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(headers().get).toHaveBeenCalledWith('timezone');
    await expect(draftMode).toHaveBeenCalled();
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import { expect, fn } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { cookies, headers, draftMode } from '@storybook/your-framework/headers.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedInEurope: Story = {
  async beforeEach() {
    // 👇 Set mock cookies, headers and draft mode ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
    draftMode.mockReturnValue({
      isEnabled: true,
      enable: fn(),
      disable: fn(),
    });
  },
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(headers().get).toHaveBeenCalledWith('timezone');
    await expect(draftMode).toHaveBeenCalled();
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { expect, fn } from 'storybook/test';

/*
 * Replace your-framework with nextjs or nextjs-vite
 * 👇 Must include the `.mock` portion of filename to have mocks typed correctly
 */
import { cookies, headers, draftMode } from '@storybook/your-framework/headers.mock';

import preview from '../.storybook/preview';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
});

export const LoggedInEurope = meta.story({
  async beforeEach() {
    // 👇 Set mock cookies, headers and draft mode ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
    draftMode.mockReturnValue({
      isEnabled: true,
      enable: fn(),
      disable: fn(),
    });
  },
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(headers().get).toHaveBeenCalledWith('timezone');
    await expect(draftMode).toHaveBeenCalled();
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyForm.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { expect, fn } from 'storybook/test';

// Replace your-framework with nextjs or nextjs-vite
import { cookies, headers, draftMode } from '@storybook/your-framework/headers';

import preview from '../.storybook/preview';

import MyForm from './my-form';

const meta = preview.meta({
  component: MyForm,
});

export const LoggedInEurope = meta.story({
  async beforeEach() {
    // 👇 Set mock cookies, headers and draft mode ahead of rendering
    cookies().set('username', 'Sol');
    headers().set('timezone', 'Central European Summer Time');
    draftMode.mockReturnValue({
      isEnabled: true,
      enable: fn(),
      disable: fn(),
    });
  },
  async play() {
    // 👇 Assert that your component called the mocks
    await expect(cookies().get).toHaveBeenCalledOnce();
    await expect(cookies().get).toHaveBeenCalledWith('username');
    await expect(headers().get).toHaveBeenCalledOnce();
    await expect(headers().get).toHaveBeenCalledWith('timezone');
    await expect(draftMode).toHaveBeenCalled();
  },
});
```
