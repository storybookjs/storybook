import type { State } from '../steps';

export type Procedure = {
  state: State;
  onComplete: (errors?: Error[]) => void;
};
