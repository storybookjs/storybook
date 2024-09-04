import type { storybookTest as storybookTestImport } from './plugin';

// make it work with --isolatedModules
export default {};

// @ts-expect-error - this is a hack to make the module's sub-path augmentable
declare module '@storybook/experimental-addon-test/vite-plugin' {
  export const storybookTest: typeof storybookTestImport;
}
