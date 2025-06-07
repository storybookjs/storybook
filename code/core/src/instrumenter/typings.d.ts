declare interface Window {
  __STORYBOOK_PREVIEW__: any;
  __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__: any;
  __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__: any;

  FEATURES: import('storybook/internal/types').StorybookConfigRaw['features'];
  LOGLEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' | undefined;
}
