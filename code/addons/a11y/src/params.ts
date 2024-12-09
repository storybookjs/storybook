import type { ElementContext, ImpactValue, RunOptions, Spec } from 'axe-core';

export interface Setup {
  element?: ElementContext;
  config: Spec;
  options: RunOptions;
}

type Impact = NonNullable<ImpactValue>;

export interface A11yParameters {
  element?: ElementContext;
  config?: Spec;
  options?: RunOptions;
  /** @deprecated Use globals.a11y.manual instead */
  manual?: boolean;
  disable?: boolean;
  warnings?: Impact[];
}
