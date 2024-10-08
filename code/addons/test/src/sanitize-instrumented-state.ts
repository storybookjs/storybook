import type { State as InstrumentedState } from '@storybook/instrumenter';

type SanitizedState = { calls: InstrumentedState['calls'] };

export function sanitizeInstrumentedState(state: InstrumentedState): SanitizedState {
  return {
    calls: state.calls.map(({ args, ...rest }) => ({ ...rest, args: [] })),
  };
}
