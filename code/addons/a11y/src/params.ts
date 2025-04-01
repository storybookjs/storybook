import type { BaseSelector, ElementContext, RunOptions, Spec } from 'axe-core';

type A11yTest = 'off' | 'todo' | 'error';

export interface A11yParameters {
  /**
   * Target element to test for accessibility issues.
   *
   * @deprecated Use {@link A11yParameters.context} instead.
   * @see https://github.com/dequelabs/axe-core/blob/develop/doc/context.md#test-dom-nodes
   */
  element?: BaseSelector;
  /**
   * Context parameter for axe-core's run function.
   *
   * @see https://github.com/dequelabs/axe-core/blob/develop/doc/context.md
   */
  context?: ElementContext;
  /**
   * Options for running axe-core.
   *
   * @see https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter
   */
  options?: RunOptions;
  /**
   * Configuration object for axe-core.
   *
   * @see https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#api-name-axeconfigure
   */
  config?: Spec;
  /** Whether to disable accessibility tests. */
  disable?: boolean;
  /** Defines how accessibility violations should be handled: 'off', 'todo', or 'error'. */
  test?: A11yTest;
}
