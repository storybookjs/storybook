import type { PresetProperty } from 'storybook/internal/types';

import type { StandaloneOptions } from './builders/utils/standalone-options';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entries = [], options) => {
  const annotations = [...entries, require.resolve('@storybook/angular-renderer/client/config')];

  if ((options as any as StandaloneOptions).enableProdMode) {
    annotations.unshift(require.resolve('@storybook/angular-renderer/client/preview-prod'));
  }

  return annotations;
};
