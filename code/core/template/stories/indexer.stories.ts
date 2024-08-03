import { expect } from '@storybook/test';
import { global as globalThis } from '@storybook/global';
import type { PlayFunctionContext } from '@storybook/core/types';

export default {
  component: globalThis.Components.Pre,
  args: { text: 'Check that id assertions in interaction tests are passing' },
  id: 'indexer-custom-meta-id',
};

export const Default = {
  play: async ({ id }: PlayFunctionContext<any>) => {
    await expect(id).toBe('indexer-custom-meta-id--default');
  },
};

export const CustomParametersId = {
  parameters: {
    __id: 'custom-id',
  },
  play: async ({ id }: PlayFunctionContext<any>) => {
    await expect(id).toBe('custom-id');
  },
};
