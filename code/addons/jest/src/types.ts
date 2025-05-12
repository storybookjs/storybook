export interface JestParameters {
  /**
   * Jest configuration
   *
   * @see https://github.com/storybookjs/storybook/blob/next/code/addons/jest/README.md#usage
   */
  jest?: string | string[] | { disabled: true };
}
