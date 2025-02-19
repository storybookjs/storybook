export interface InteractionsParameters {
  /**
   * Interactions configuration
   *
   * @see https://storybook.js.org/docs/essentials/interactions
   */
  test: {
    /** Ignore unhandled errors during test execution */
    dangerouslyIgnoreUnhandledErrors?: boolean;

    /** Whether to throw exceptions coming from the play function */
    throwPlayFunctionExceptions?: boolean;
  };
}
