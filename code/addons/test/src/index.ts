import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';
import type { storybookTest as storybookTestImport } from './vitest-plugin';

export default () => definePreview(addonAnnotations);

export type { TestParameters } from './types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore-error - this is a hack to make the module's sub-path augmentable
declare module '@storybook/experimental-addon-test/vitest-plugin' {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-error - this is a hack to make the module's sub-path augmentable
  export const storybookTest: typeof storybookTestImport;
}
