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
   * Optional script to run Storybook. If provided, Vitest will start Storybook using this script
   * when ran in watch mode.
   *
   * @default undefined
   */
  storybookScript?: string;
  /**
   * The URL where Storybook is hosted. This is used to provide a link to the story in the test
   * output on failures.
   *
   * @default 'http://localhost:6006'
   */
  storybookUrl?: string;
  /** Tags to include, exclude, or skip. These tags are defined as annotations in your story or meta. */
  tags?: {
    include?: string[];
    exclude?: string[];
    skip?: string[];
  };

  /**
   * Whether to disable addon docs features while running tests.
   *
   * Most users don't need addon docs for tests, the only scenario where you might need it is if you
   * need to read and parse MDX files as part of rendering your components.
   *
   * @default true
   */
  disableAddonDocs?: boolean;

  /**
   * Globals applied to every story run by this project, merged under the values Storybook sets
   * internally. Use it to pin a toolbar global for the whole run — most usefully to test a
   * specific theme: define one Vitest project per theme, each with a different value, e.g.
   * `storybookTest({ initialGlobals: { theme: 'dark' } })`. Equivalent to `initialGlobals` in
   * `.storybook/preview`, but per project instead of global.
   *
   * @default {}
   */
  initialGlobals?: Record<string, unknown>;
};

export type InternalOptions = Required<UserOptions> & {
  debug: boolean;
  tags: Required<UserOptions['tags']>;
  includeStories: string[];
  /** This is the root of the vitest config where the `storybookTest` plugin is applied */
  vitestRoot: string;
};
