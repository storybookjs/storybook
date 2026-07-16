export type UserOptions = {
  /**
   * The directory where the Storybook configuration is located, resolved against the Vite
   * configuration file's directory (or `process.cwd()`).
   *
   * @default '.storybook'
   */
  configDir?: string;
  /**
   * The directory where a static Storybook is written by `vite build --mode storybook`, resolved
   * against Vite's project root.
   *
   * @default './storybook-static'
   */
  outputDir?: string;
  /**
   * The base URL path where Storybook is mounted inside the Vite dev server. Normalized to a
   * leading-slash, no-trailing-slash form (e.g. `'storybook/'` becomes `'/storybook'`).
   *
   * @default '/__storybook'
   */
  base?: string;
};
