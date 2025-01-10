import type { ElementContext, ImpactValue, RunOptions, Spec } from 'axe-core';

export interface Setup {
  element?: ElementContext;
  config: Spec;
  options: RunOptions;
}

export interface A11yParameters {
  element?: ElementContext;
  config?: Spec;
  options?: RunOptions;
  /** @deprecated Use globals.a11y.manual instead */
  manual?: boolean;
  disable?: boolean;
}
