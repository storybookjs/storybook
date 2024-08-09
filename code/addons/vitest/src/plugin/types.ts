export type UserOptions = {
  /**
   *  The directory where the Storybook configuration is located, relative to the vitest configuration file.
   *  If not provided, the plugin will use '.storybook' in the current working directory.
   *  @default '.storybook'
   */
  configDir?: string;
  /**
   *  Optional script to run Storybook.
   *  If provided, Vitest will start Storybook using this script when ran in watch mode.
   *  @default undefined
   */
  storybookScript?: string;
  /**
   *  Whether to skip running Storybook when running tests in watch mode.
   *  Only relevant when `storybookScript` is provided.
   *  @default false
   */
  skipRunningStorybook?: boolean;
  /**
   *  Whether to generate DOM snapshots for every story file.
   *  @default false
   */
  snapshot?: boolean;
  /**
   *  The URL where Storybook is hosted.
   *  This is used to provide a link to the story in the test output on failures.
   *  @default 'http://localhost:6006'
   */
  storybookUrl?: string;
  /**
   * Tags to include, exclude, or skip. These tags are defined as annotations in your story or meta.
   */
  tags?: {
    include?: string[];
    exclude?: string[];
    skip?: string[];
  };
};

export type InternalOptions = Required<UserOptions> & {
  debug: boolean;
  tags: Required<UserOptions['tags']>;
};
