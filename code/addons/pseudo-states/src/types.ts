import type { PSEUDO_STATES } from './constants';

export type PseudoState = keyof typeof PSEUDO_STATES;

export type PseudoStateConfig = {
  [P in PseudoState]?: boolean | string | string[];
};

export interface PseudoParameter extends PseudoStateConfig {
  rootSelector?: string;
}

export interface PseudoParameters {
  /**
   * Pseudo state configuration
   *
   * @see https://storybook.js.org/addons/storybook-addon-pseudo-states
   */
  pseudo?: PseudoParameter;
}

export interface PseudoTypes {
  parameters: PseudoParameters;
}
