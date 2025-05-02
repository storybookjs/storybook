import type { RunOptions, Selector, SelectorList, Spec } from 'axe-core';

export type SelectorWithoutNode = Omit<Selector, 'Node'> | Omit<SelectorList, 'NodeList'>;

// copy of ContextObject from axe-core
export type ContextObjectWithoutNode =
  | {
      include: SelectorWithoutNode;
      exclude?: SelectorWithoutNode;
    }
  | {
      exclude: SelectorWithoutNode;
      include?: SelectorWithoutNode;
    };
// copy of ContextSpec from axe-core
export type ContextSpecWithoutNode = SelectorWithoutNode | ContextObjectWithoutNode;

type A11yTest = 'off' | 'todo' | 'error';

export interface A11yParameters {
  /**
   * Context parameter for axe-core's run function, except without support for passing Nodes and
   * NodeLists directly.
   *
   * @see https://github.com/dequelabs/axe-core/blob/develop/doc/context.md
   */
  context?: ContextSpecWithoutNode;
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
