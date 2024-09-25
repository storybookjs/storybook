import type { storybookTest as storybookTestImport } from './vitest-plugin';

// make it work with --isolatedModules
export default {};

// @ts-expect-error - this is a hack to make the module's sub-path augmentable
declare module '@storybook/experimental-addon-test/vitest-plugin' {
  export const storybookTest: typeof storybookTestImport;
}
