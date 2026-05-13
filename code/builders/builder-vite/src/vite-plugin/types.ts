export type UserOptions = {
  /**
   * The directory where the Storybook configuration is located, relative to the vitest
   * configuration file. If not provided, the plugin will use '.storybook' in the current working
   * directory.
   *
   * @default '.storybook'
   */
  configDir?: string;
  /**
   * The URL where Storybook is hosted. This is used to provide a link to the story in the test
   * output on failures.
   *
   * @default 'http://localhost:6006'
   */
  storybookUrl?: string;
};
