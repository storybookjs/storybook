export interface TestParameters {
  /**
   * Test addon configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/test-addon
   */
  test: {
    /** Ignore unhandled errors during test execution */
    dangerouslyIgnoreUnhandledErrors?: boolean;

    /** Whether to throw exceptions coming from the play function */
    throwPlayFunctionExceptions?: boolean;
  };
}
