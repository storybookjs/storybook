export interface ThemeAddonState {
  themesList: string[];
  themeDefault?: string;
}

export interface ThemesParameters {
  /**
   * Themes configuration
   *
   * @see https://github.com/storybookjs/storybook/blob/next/code/addons/themes/README.md
   */
  themes: {
    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;
    /** Which theme to override for the story */
    themeOverride?: string;
  };
}

export interface ThemesGlobals {
  /** Which theme to override for the story */
  theme?: string;
}
