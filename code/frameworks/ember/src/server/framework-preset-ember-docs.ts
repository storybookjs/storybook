import { hasDocsOrControls } from 'storybook/internal/docs-tools';
import type { PresetProperty } from 'storybook/internal/types';

import { findDistFile } from '../util';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = [], options) => {
  if (!hasDocsOrControls(options)) {
    return entry;
  }
  return [...entry, findDistFile(__dirname, 'client/preview/docs/config')];
};
