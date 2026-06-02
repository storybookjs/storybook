import type { API_IframeRenderer } from 'storybook/internal/types';

import type { ModuleFn } from '../lib/types.tsx';

export interface SubState {
  addonsLoaded: boolean;
}

export interface SubAPI {
  renderPreview?: API_IframeRenderer;
  /** True after manager addon `register` callbacks have run (open-service listeners are installed). */
  getAddonsLoaded: () => boolean;
}

export const init: ModuleFn<SubAPI, SubState> = ({ provider, store, fullAPI }) => {
  return {
    api: {
      ...(provider.renderPreview ? { renderPreview: provider.renderPreview } : {}),
      getAddonsLoaded: () => store.getState().addonsLoaded,
    },
    state: { addonsLoaded: false },
    init: () => {
      provider.handleAPI(fullAPI);
      store.setState({ addonsLoaded: true });
    },
  };
};
