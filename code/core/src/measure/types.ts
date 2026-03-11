export interface MeasureParameters {
  /**
   * Measure configuration
   *
   * @see https://storybook.js.org/docs/essentials/measure-and-outline#parameters
   */
  measure?: {
    /**
     * Removes the tool and disables the feature's behavior. If you wish to turn off this feature
     * for the entire Storybook, you can set the option in your `main.js|ts` configuration file.
     *
     * @see https://storybook.js.org/docs/essentials/measure-and-outline#disable
     */
    disable?: boolean;
  };
}

export interface MeasureTypes {
  parameters: MeasureParameters;
}
