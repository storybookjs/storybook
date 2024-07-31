import { PresetProperty } from 'storybook/internal/types';
import { hasDocsOrControls } from 'storybook/internal/docs-tools';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = [], options) => {
  if (!hasDocsOrControls(options)) return entry;
  return [...entry, require.resolve('../client/docs/config')];
};
