export const ADDON_ID = 'storybook/docs';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const PARAM_KEY = `docs`;

export const SNIPPET_RENDERED = `${ADDON_ID}/snippet-rendered`;

export enum SourceType {
  /**
   * AUTO is the default
   *
   * Use the CODE logic if:
   *
   * - The user has set a custom source snippet in `docs.source.code` story parameter
   * - The story is not an args-based story
   *
   * Use the DYNAMIC rendered snippet if the story is an args story
   */
  AUTO = 'auto',

  /** Render the code extracted by source-loader */
  CODE = 'code',

  /** Render dynamically-rendered source snippet from the story's virtual DOM (currently React only) */
  DYNAMIC = 'dynamic',
}
