export type UserOptions = {
  /**
   * The Storybook configuration directory, resolved against `process.cwd()`.
   *
   * @default '.storybook'
   */
  configDir?: string;
  /**
   * Static Storybook output directory, resolved against Vite's project root.
   *
   * @default './storybook-static'
   */
  outputDir?: string;
  /**
   * Mounting point of Storybook in the Vite dev server, normalised to a leading slash and no
   * trailing slash.
   *
   * @default '/__storybook'
   */
  base?: string;
};
