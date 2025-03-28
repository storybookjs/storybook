import type { ElementContext, RunOptions, Spec } from 'axe-core';

type A11yTest = 'off' | 'todo' | 'error';

export interface Setup {
  element?: ElementContext;
  config: Spec;
  options: RunOptions;
}

export interface A11yParameters {
  element?: ElementContext;
  config?: Spec;
  options?: RunOptions;
  disable?: boolean;
  test?: A11yTest;
}
