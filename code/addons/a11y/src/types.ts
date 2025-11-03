import type { AxeResults, NodeResult, Result } from 'axe-core';

import type { A11yParameters as A11yParams } from './params';

export type A11YReport = EnhancedResults | { error: Error };

export interface A11yParameters {
  /**
   * Accessibility configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/accessibility-testing
   */
  a11y?: A11yParams;
}

export interface A11yGlobals {
  /**
   * Accessibility configuration
   *
   * @see https://storybook.js.org/docs/writing-tests/accessibility-testing
   */
  a11y?: {
    /**
     * Prevent the addon from executing automated accessibility checks upon visiting a story. You
     * can still trigger the checks from the addon panel.
     *
     * @see https://storybook.js.org/docs/writing-tests/accessibility-testing#turn-off-automated-a11y-tests
     */
    manual?: boolean;
  };
}

export const RuleType = {
  VIOLATION: 'violations',
  PASS: 'passes',
  INCOMPLETION: 'incomplete',
} as const;

export type RuleType = (typeof RuleType)[keyof typeof RuleType];

export type EnhancedNodeResult = NodeResult & {
  linkPath: string;
};

export type EnhancedResult = Omit<Result, 'nodes'> & {
  nodes: EnhancedNodeResult[];
};

export type EnhancedResults = Omit<AxeResults, 'incomplete' | 'passes' | 'violations'> & {
  incomplete: EnhancedResult[];
  passes: EnhancedResult[];
  violations: EnhancedResult[];
};

export interface A11yTypes {
  parameters: A11yParameters;
  globals: A11yGlobals;
}

export type Status =
  | 'initial'
  | 'manual'
  | 'running'
  | 'error'
  | 'component-test-error'
  | 'ran'
  | 'ready';
