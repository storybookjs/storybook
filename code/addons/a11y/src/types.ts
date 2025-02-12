import type { AxeResults, ElementContext, RunOptions, Spec } from 'axe-core';

export type A11YReport = AxeResults | { error: Error };

export interface A11yParameters {
  /**
   * Accessibility configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/accessibility-testing
   */
  a11y?: {
    /** Manual configuration for specific elements */
    element?: ElementContext;

    /**
     * Configuration for the accessibility rules
     *
     * @see https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#api-name-axeconfigure
     */
    config?: Spec;

    /**
     * Options for the accessibility checks To learn more about the available options,
     *
     * @see https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter
     */
    options?: RunOptions;

    /** Remove the addon panel and disable the addon's behavior */
    disable?: boolean;
  };
}

export interface A11yGlobals {
  /**
   * Accessibility configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/accessibility-testing
   */
  a11y: {
    /**
     * Prevent the addon from executing automated accessibility checks upon visiting a story. You
     * can still trigger the checks from the addon panel.
     *
     * @see https://storybook.js.org/docs/writing-tests/accessibility-testing#turn-off-automated-a11y-tests
     */
    manual?: boolean;
  };
}
