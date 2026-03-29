export interface StorybookPluginOptions {
  /** Path to .storybook config directory, relative to project root. Default: '.storybook' */
  configDir?: string;
  /** Base URL path for Storybook. Must start and end with '/'. Default: '/__storybook/' */
  basePath?: string;
  /** Whether to enable the manager UI. When false, only the preview iframe is served. Default: true */
  enableManager?: boolean;
  /** Output directory for static builds via `vite build --app`. Default: 'storybook-static' */
  outputDir?: string;
}
