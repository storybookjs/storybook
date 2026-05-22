import type { PlayFunctionContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  args: { text: 'No content' },
};

// A story can be exported under a renamed, string-literal name, e.g. `export { Local as 'あ' }`.
// This is valid ESM and the CSF indexer must pick it up instead of silently dropping it.

const RenamedStringExport = {
  play: async ({ name }: PlayFunctionContext<any>) => {
    await expect(name).toBe('あ');
  },
};

const RenamedSpacedExport = {
  play: async ({ name }: PlayFunctionContext<any>) => {
    await expect(name).toBe('With Spaces');
  },
};

export { RenamedStringExport as 'あ', RenamedSpacedExport as 'With Spaces' };
