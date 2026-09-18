import type { API_IframeRenderer } from 'storybook/internal/types';

import type { ModuleFn } from '../lib/types.tsx';

export interface SubAPI {
  renderPreview?: API_IframeRenderer;
}

export const init: ModuleFn<SubAPI, {}> = ({ provider }) => {
  return {
    api: provider.renderPreview ? { renderPreview: provider.renderPreview } : {},
    state: {},
  };
};
