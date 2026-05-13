export type UserOptions = {
  /**
   * The directory where the Storybook configuration is located, resolved against the Vite
   * configuration file's directory (or `process.cwd()`).
   *
   * @default '.storybook'
   */
  configDir?: string;
  /**
   * The base URL path where Storybook is mounted inside the Vite dev server.
   *
   * @default '/__storybook'
   */
  base?: string;
};
