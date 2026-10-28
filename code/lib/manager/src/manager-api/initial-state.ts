import merge from './lib/merge.ts';
import type { State } from './root.tsx';

interface Addition {
  [key: string]: any;
}
type Additions = Addition[];

// Returns the initialState of the app
const main = (...additions: Additions): State =>
  additions.reduce((acc: State, item) => merge<State>(acc, item), {} as any);

export default main;
