import { Context, createContext as ReactCreateContext } from 'react';

import type { API, Combo, State } from './root.tsx';

export const createContext = ({
  api,
  state,
}: Combo): Context<{
  api: API;
  state: State;
}> => ReactCreateContext({ api, state });
