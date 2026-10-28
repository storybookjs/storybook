export interface InteractionsParameters {
  /**
   * Interactions configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/interaction-testing
   */
  interactions?: {
    /**
     * Removes the addon panel and disables the feature's behavior. If you wish to turn off this
     * feature for the entire Storybook, you can set the option in your `main.js|ts` configuration
     * file.
     *
     * @see https://storybook.js.org/docs/writing-tests/interaction-testing#disable
     */
    disable?: boolean;
  };
}

export interface InteractionsTypes {
  parameters: InteractionsParameters;
}
