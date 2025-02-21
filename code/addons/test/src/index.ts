import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { TestTypes } from './types';
import type { storybookTest as storybookTestImport } from './vitest-plugin';

export default () => definePreviewAddon<TestTypes>(addonAnnotations);

export type { TestTypes } from './types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore-error - this is a hack to make the module's sub-path augmentable
declare module '@storybook/experimental-addon-test/vitest-plugin' {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-error - this is a hack to make the module's sub-path augmentable
  export const storybookTest: typeof storybookTestImport;
}
