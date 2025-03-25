export interface ControlsParameters {
  /**
   * Controls configuration
   *
   * @see https://storybook.js.org/docs/essentials/controls#parameters-1
   */
  controls: {
    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;

    /** Disable the ability to create or edit stories from the Controls panel */
    disableSaveFromUI?: boolean;

    /** Exclude specific properties from the Controls panel */
    exclude?: string[] | RegExp;

    /**
     * Show the full documentation for each property in the Controls addon panel, including the
     * description and default value.
     */
    expanded?: boolean;

    /** Exclude only specific properties in the Controls panel */
    include?: string[] | RegExp;

    /**
     * Preset color swatches for the color picker control
     *
     * @example PresetColors: [{ color: '#ff4785', title: 'Coral' }, 'rgba(0, 159, 183, 1)',
     * '#fe4a49']
     */
    presetColors?: Array<string | { color: string; title?: string }>;

    /** Controls sorting order */
    sort?: 'none' | 'alpha' | 'requiredFirst';
  };
}
