import type { API_IframeRenderer } from '@storybook/core/types';

import type { ModuleFn } from '../lib/types';

export interface SubAPI {
  renderPreview?: API_IframeRenderer;
}

export const init: ModuleFn<SubAPI, {}> = ({ provider, fullAPI }) => {
  return {
    api: provider.renderPreview ? { renderPreview: provider.renderPreview } : {},
    state: {},
    init: () => {
      provider.handleAPI(fullAPI);
    },
  };
};
