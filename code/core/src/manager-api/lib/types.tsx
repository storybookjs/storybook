import type { RouterData } from 'storybook/internal/router';
import type { API_ProviderData } from 'storybook/internal/types';

import type { API, State } from '../root';
import type Store from '../store';

export type ModuleFn<APIType = unknown, StateType = unknown> = (
  m: ModuleArgs,
  options?: any
) => {
  init?: () => void | Promise<void>;
  api: APIType;
  state: StateType;
};

export type ModuleArgs = RouterData &
  API_ProviderData<API> & {
    mode?: 'production' | 'development';
    state: State;
    fullAPI: API;
    store: Store;
  };
