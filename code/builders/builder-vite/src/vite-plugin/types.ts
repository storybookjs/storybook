export type UserOptions = {
  /**
   * The Storybook configuration directory, resolved against `process.cwd()`.
   *
   * @default '.storybook'
   */
  configDir?: string;
  /**
   * static Storybook output directory, resolved against Vite's project root.
   *
   * @default './storybook-static'
   */
  outputDir?: string;
  /**
   * Mounting point of Storybook in the Vite dev server
   *
   * @default '/__storybook'
   */
  base?: string;
};
