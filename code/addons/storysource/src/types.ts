export interface StorySourceParameters {
  /**
   * Storysource addon configuration
   *
   * @see https://github.com/storybookjs/storybook/tree/next/code/addons/storysource
   */
  storySource?: {
    /** Dark mode for source code */
    dark?: boolean;

    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;

    /** Source code formatting options */
    format?: 'jsx' | 'typescript' | 'javascript';

    /** Source code language */
    language?: string;

    /** Source code loader options */
    loaderOptions?: {
      /** Ignore specific patterns */
      ignore?: string[];
      /** Include specific patterns */
      include?: string[];
      /** Parser options */
      parser?: string;
      /** Pretty print source code */
      prettierConfig?: object;
    };

    /** Show story source code */
    showCode?: boolean;

    /** Source code transformations */
    transformSource?: (source: string, storyContext: any) => string;
  };
}
